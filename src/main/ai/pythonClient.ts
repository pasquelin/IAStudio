import { log } from '@main/log'
import { createProcessClient } from '@main/processClient'
import type { PythonPort } from './pythonProcess'
import {
  CANCEL_OP,
  engineRequest,
  isHello,
  PROTOCOL_VERSION,
  readHardware,
  type EngineFrame,
  type EngineHardware,
  type EngineHello,
  type EngineRequest,
} from './pythonProtocol'

/**
 * One engine process, from its greeting to its death. Numbering the runs, holding the promises and
 * rejecting the lot when it dies are `processClient`'s; what is here is what differs — a handshake
 * that comes unasked, and a deadline on everything.
 */

/** Reading a Python stack can fail — and it can also hang, which no exit code ever reports. */
export const HELLO_TIMEOUT_MS = 10_000

/**
 * The whole of the health check, and it costs nothing while nothing is in flight: an engine that
 * stops answering is dead, whatever the process table says. A heartbeat beside this would be a
 * second timer measuring the same thing, on a process that has no long op to hide behind yet.
 */
export const REQUEST_TIMEOUT_MS = 5_000

const GONE = 'the local AI engine is gone'

export type PythonListeners = {
  /** The engine failed AFTER it greeted — as opposed to failing to greet at all. */
  onFailure: (error: Error) => void
}

export type PythonClient = {
  /** Resolves on the greeting, rejects when the versions disagree or none arrives in time. */
  ready: Promise<EngineHello>
  hardware: () => Promise<EngineHardware>
  close: () => void
}

export function createPythonClient(port: PythonPort, listeners: PythonListeners): PythonClient {
  let closed = false
  let settleReady: {
    resolve: (hello: EngineHello) => void
    reject: (error: Error) => void
  } | null = null

  // The executor runs before this returns, so the handshake below always has somewhere to settle.
  const ready = new Promise<EngineHello>((resolve, reject) => {
    settleReady = { resolve, reject }
  })

  // Handled here so a refusal on its way to the caller never surfaces as an unhandled rejection:
  // the greeting can fail before anyone has asked for it.
  void ready.catch(() => {})

  const greeting = setTimeout(
    () => fail(new Error(`the engine did not greet within ${HELLO_TIMEOUT_MS} ms`)),
    HELLO_TIMEOUT_MS,
  )

  function fail(error: Error): void {
    if (closed) return
    closed = true
    clearTimeout(greeting)
    // Killed rather than left running: a process that hangs answers no exit code, and this studio
    // would hold a socket nobody reads for the rest of the session.
    port.kill()

    const waiting = settleReady
    settleReady = null

    // A failure while greeting is that handshake's answer; one after it belongs to whoever holds
    // the engine — the same split `sttClient` makes between a load and a session.
    if (waiting) waiting.reject(error)
    else listeners.onFailure(error)
  }

  const client = createProcessClient<EngineRequest, EngineFrame, unknown>({
    port,
    // An event belongs to no run, and no run is ever numbered zero.
    runOf: frame => ('id' in frame ? frame.id : 0),
    read: frame =>
      'err' in frame
        ? { kind: 'failed', error: `${frame.err.code}: ${frame.err.message}` }
        : { kind: 'settled', result: 'ok' in frame ? frame.ok : null },
    gone: GONE,
    cancel: id => engineRequest(id, CANCEL_OP),
  })

  port.onMessage(frame => {
    if (!('evt' in frame)) return

    if (!isHello(frame)) {
      // `runtime.error`: the engine could not read a frame, and there is no run to answer under.
      log.warn('engine', frame.message)
      return
    }

    clearTimeout(greeting)
    const waiting = settleReady
    settleReady = null
    if (!waiting) return

    if (frame.protocol !== PROTOCOL_VERSION) {
      // Killed, never degraded: a stale engine sitting in a cache would answer half the vocabulary
      // and fail at whichever call happened to need the other half.
      closed = true
      port.kill()
      waiting.reject(
        new Error(
          `the engine speaks protocol ${frame.protocol}, the studio speaks ${PROTOCOL_VERSION}`,
        ),
      )
      return
    }

    waiting.resolve(frame)
  })

  port.onFailure(error => fail(error))

  const beforeDeadline = <T>(work: Promise<T>, what: string): Promise<T> =>
    new Promise<T>((resolve, reject) => {
      const deadline = setTimeout(() => {
        const late = new Error(`the engine did not answer ${what} within ${REQUEST_TIMEOUT_MS} ms`)
        reject(late)
        fail(late)
      }, REQUEST_TIMEOUT_MS)

      void work.then(resolve, reject).finally(() => clearTimeout(deadline))
    })

  return {
    ready,

    hardware: async () => {
      if (closed) throw new Error(GONE)

      const answer = await beforeDeadline(
        client.send(id => engineRequest(id, 'hardware.info')),
        'hardware.info',
      )
      return readHardware(answer)
    },

    close: () => {
      closed = true
      clearTimeout(greeting)
      const waiting = settleReady
      settleReady = null
      // Rejected rather than left pending: whoever awaited the greeting would otherwise wait for a
      // process that has just been killed, and nothing would ever answer.
      waiting?.reject(new Error(GONE))
      port.kill()
    },
  }
}
