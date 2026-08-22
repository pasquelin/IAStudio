import { spawn, type ChildProcess } from 'node:child_process'
import { unlink } from 'node:fs/promises'
import { createServer, type Socket } from 'node:net'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { log } from '@main/log'
import { readFrame, type EngineFrame, type EngineRequest } from './pythonProtocol'

/**
 * The engine process and the socket it answers on. `child_process.spawn` and not `forkedWorker.ts`,
 * whose `utilityProcess.fork` only ever launches Node; the port contract is the same one.
 *
 * A socket rather than stdio, and not for latency — both are under 0.05 ms at the size of a control
 * frame. **stdout is shared**: one Python warning corrupts it, and a PyTorch stack writes them.
 */
export type PythonPort = {
  postMessage: (message: EngineRequest) => void
  onMessage: (listener: (frame: EngineFrame) => void) => void
  /** The process died. Whatever it was asked will never be answered. */
  onFailure: (listener: (error: Error) => void) => void
  kill: () => void
}

export type PythonProcessOptions = {
  /** The interpreter. Passed in rather than resolved here: packaging is not this file's business. */
  command: string
  args: readonly string[]
  /**
   * Names the process in the error every waiting caller is given when it exits. Never `label`:
   * `main/no-hardcoded-text.test.ts` reads that field as a native menu item's, and this word
   * reaches no screen.
   */
  processName: string
  /** Told the process is gone, so whoever holds this port can drop it. */
  onExit?: () => void
}

let opened = 0

/**
 * One endpoint per open, and the process id is in it: two studios, or one studio restarting its
 * engine, must never meet on the same socket. Kept short — a unix socket path is capped around
 * 104 bytes on macOS, and the temporary folder there already spends half of it.
 */
function endpointOf(): string {
  opened += 1
  const name = `ias-engine-${process.pid}-${opened}`
  return process.platform === 'win32' ? `\\\\.\\pipe\\${name}` : join(tmpdir(), `${name}.sock`)
}

export function openPythonProcess({
  command,
  args,
  processName,
  onExit = () => {},
}: PythonProcessOptions): PythonPort {
  const endpoint = endpointOf()
  const frameListeners: ((frame: EngineFrame) => void)[] = []
  const failureListeners: ((error: Error) => void)[] = []
  /** Posted before the engine connected. The socket exists first, the process opens it second. */
  const waiting: EngineRequest[] = []

  let connection: Socket | null = null
  let child: ChildProcess | null = null
  let dead = false

  const fail = (error: Error): void => {
    // A crash reaches this twice — the socket ends and the process exits — and a caller told twice
    // that its engine died would count two failures against a restart budget that saw one.
    if (dead) return
    dead = true
    for (const listener of failureListeners) listener(error)
  }

  const server = createServer(socket => {
    connection = socket
    // Control frames are small and answered one at a time: Nagle would hold each one back.
    socket.setNoDelay(true)

    let pending = ''
    socket.on('data', chunk => {
      pending += chunk.toString('utf8')
      for (let cut = pending.indexOf('\n'); cut >= 0; cut = pending.indexOf('\n')) {
        const line = pending.slice(0, cut).trim()
        pending = pending.slice(cut + 1)
        if (!line) continue

        const frame = readFrame(line)
        if (!frame) log.warn('engine', `dropped a frame it could not read: ${line.slice(0, 200)}`)
        else for (const listener of frameListeners) listener(frame)
      }
    })
    socket.on('error', error => fail(error))

    for (const message of waiting.splice(0)) socket.write(`${JSON.stringify(message)}\n`)
  })

  server.on('error', error => fail(error))

  const close = (): void => {
    server.close()
    // The file outlives the process that bound it, and a studio restarting its engine would
    // otherwise leave one behind per attempt. Windows names a pipe rather than a file.
    if (process.platform !== 'win32') void unlink(endpoint).catch(() => {})
  }

  // Spawned once the socket is answering: the engine connects at start-up and has nothing to poll.
  server.listen(endpoint, () => {
    child = spawn(command, [...args, '--socket', endpoint], {
      stdio: ['ignore', 'pipe', 'pipe'],
      // Otherwise a Python stack trace sits in a buffer while the studio wonders why nothing came.
      env: { ...process.env, PYTHONUNBUFFERED: '1' },
    })

    const journal = (level: 'info' | 'error') => (chunk: Buffer) => {
      const line = chunk.toString('utf8').trimEnd()
      if (line) log[level]('engine', line)
    }
    child.stdout?.on('data', journal('info'))
    child.stderr?.on('data', journal('error'))

    child.on('error', error => {
      close()
      fail(error)
    })

    child.on('exit', code => {
      close()
      // Whatever the code: a clean exit leaves the same callers waiting as a crash.
      fail(new Error(`${processName} exited with code ${code}`))
      onExit()
    })
  })

  return {
    postMessage: message => {
      if (connection) connection.write(`${JSON.stringify(message)}\n`)
      else waiting.push(message)
    },
    onMessage: listener => frameListeners.push(listener),
    onFailure: listener => failureListeners.push(listener),
    kill: () => {
      close()
      connection?.destroy()
      // Both, and in this order: the engine leaves on its own when the stream ends, and the signal
      // is what answers the one that does not.
      child?.kill()
    },
  }
}
