import { mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from 'vitest'
import { openPythonProcess, type PythonPort } from './pythonProcess'
import { PROTOCOL_VERSION, type EngineFrame } from './pythonProtocol'

/**
 * A stand-in engine, in Node rather than in Python: what is under test is the socket, the framing
 * and the death of a process — none of which knows what language the other end is written in. The
 * real engine is covered by `engine/tests`, which the same gate runs.
 *
 * A file rather than `node -e`: node parses `--socket` as one of ITS options when the script came
 * from `-e`, and exits 9 before the code ever runs.
 */
const STAND_IN = `
const net = require('node:net')
const socket = net.connect(process.argv[process.argv.indexOf('--socket') + 1], () => {
  if (process.env.NOISE) socket.write(process.env.NOISE + '\\n')
  socket.write(JSON.stringify({
    v: ${PROTOCOL_VERSION}, evt: 'engine.hello',
    engine: '0.0.0', protocol: ${PROTOCOL_VERSION}, python: '3.12.0', platform: 'test',
  }) + '\\n')
})
let pending = ''
socket.on('data', chunk => {
  pending += chunk
  for (let cut = pending.indexOf('\\n'); cut >= 0; cut = pending.indexOf('\\n')) {
    const line = pending.slice(0, cut)
    pending = pending.slice(cut + 1)
    if (line) {
      const asked = JSON.parse(line)
      socket.write(JSON.stringify({ v: ${PROTOCOL_VERSION}, id: asked.id, ok: asked.op }) + '\\n')
    }
  }
})
`

let folder = ''
const scriptAt = (name: string): string => join(folder, name)

beforeAll(() => {
  folder = mkdtempSync(join(tmpdir(), 'ias-engine-test-'))
  writeFileSync(scriptAt('standIn.js'), STAND_IN)
  writeFileSync(scriptAt('leaves.js'), 'process.exit(0)')
})

afterAll(() => rmSync(folder, { recursive: true, force: true }))
afterEach(() => vi.unstubAllEnvs())

function watch(port: PythonPort) {
  const frames: EngineFrame[] = []
  const deaths: Error[] = []
  port.onMessage(frame => frames.push(frame))
  port.onFailure(error => deaths.push(error))
  return { frames, deaths }
}

const open = (script: string, onExit?: () => void): PythonPort =>
  openPythonProcess({
    command: process.execPath,
    args: [scriptAt(script)],
    processName: 'the stand-in engine',
    onExit,
  })

describe('the socket the engine answers on', () => {
  it('delivers what the engine writes, one frame per line', async () => {
    const port = open('standIn.js')
    const seen = watch(port)

    await vi.waitFor(() => expect(seen.frames).toHaveLength(1), 5_000)
    expect(seen.frames[0]).toMatchObject({ evt: 'engine.hello', platform: 'test' })
    port.kill()
  })

  /** The socket exists before the process does, so a caller may post before anyone is listening. */
  it('holds what was posted before the engine connected', async () => {
    const port = open('standIn.js')
    const seen = watch(port)
    port.postMessage({ v: PROTOCOL_VERSION, id: 1, op: 'hardware.info', params: {} })

    await vi.waitFor(() => expect(seen.frames).toHaveLength(2), 5_000)
    expect(seen.frames[1]).toMatchObject({ id: 1, ok: 'hardware.info' })
    port.kill()
  })

  /** A Python library writing to the socket is not a reason to take the engine down. */
  it('drops a line it cannot read rather than the connection', async () => {
    vi.stubEnv('NOISE', 'FutureWarning: torch is deprecated')
    const port = open('standIn.js')
    const seen = watch(port)

    await vi.waitFor(() => expect(seen.frames).toHaveLength(1), 5_000)
    expect(seen.frames[0]).toMatchObject({ evt: 'engine.hello' })
    port.kill()
  })
})

describe('the death of the engine', () => {
  /** No `exit` follows an ENOENT, so the holder hears about it here or nowhere. */
  it('reports a process that could never be started, and says it is gone', async () => {
    let left = false
    const port = openPythonProcess({
      command: 'ia-studio-no-such-interpreter',
      args: [],
      processName: 'the stand-in engine',
      onExit: () => (left = true),
    })
    const seen = watch(port)

    await vi.waitFor(() => expect(seen.deaths).toHaveLength(1), 5_000)
    expect(left).toBe(true)
    port.kill()
  })

  /** A restart budget must not spend an attempt on a death the studio itself asked for. */
  it('says nothing of an exit that was asked for', async () => {
    let left = false
    const port = open('standIn.js', () => (left = true))
    const seen = watch(port)

    await vi.waitFor(() => expect(seen.frames).toHaveLength(1), 5_000)
    port.kill()
    await vi.waitFor(() => expect(left).toBe(true), 5_000)

    expect(seen.deaths).toEqual([])
  })

  /** Whatever the code: a clean exit leaves the same callers waiting as a crash. */
  it('reports an exit that was not an error as a failure all the same', async () => {
    const port = open('leaves.js')
    const seen = watch(port)

    await vi.waitFor(() => expect(seen.deaths).toHaveLength(1), 5_000)
    expect(seen.deaths[0]?.message).toContain('the stand-in engine exited with code 0')
    port.kill()
  })
})
