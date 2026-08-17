import { log } from '@main/log'
import { isReady, type SttLoad, type SttMessage, type SttResponse } from './sttProtocol'

/**
 * The worker process, reduced to what the client needs. Injected rather than imported so the
 * protocol can be tested without forking anything — `utilityProcess` needs a live app.
 */
export type SttPort = {
  postMessage: (message: SttMessage) => void
  onMessage: (listener: (response: SttResponse) => void) => void
  /** The process died. Whatever it was told is lost, and nothing more will come back. */
  onFailure: (listener: (error: Error) => void) => void
  kill: () => void
}

export type SttListeners = {
  onPartial: (text: string) => void
  onFinal: (text: string, latencyMs: number) => void
  /** The engine failed after it had loaded — as opposed to failing to load at all. */
  onFailure: (error: Error) => void
}

export type SttClient = {
  /** Resolves when the engine is up, rejects when it could not be. Called once per process. */
  load: (request: Omit<SttLoad, 'load'>) => Promise<void>
  push: (audio: Int16Array) => void
  flush: () => void
  cancel: () => void
  close: () => void
}

export function createSttClient(port: SttPort, listeners: SttListeners): SttClient {
  // A dead process swallows `postMessage` without a word, so audio pushed into one would look
  // like a microphone nobody is listening to. Same guard `peaksClient` carries, same reason.
  let closed = false
  let settleLoad: { resolve: () => void; reject: (error: Error) => void } | null = null

  const fail = (error: Error): void => {
    const waiting = settleLoad
    settleLoad = null

    // A failure while loading is that load's answer; one after it belongs to the session.
    if (waiting) waiting.reject(error)
    else listeners.onFailure(error)
  }

  port.onMessage(response => {
    if (isReady(response)) {
      const waiting = settleLoad
      settleLoad = null
      if (!waiting) return

      if (response.ready) waiting.resolve()
      else waiting.reject(new Error(response.error))
      return
    }

    if ('partial' in response) listeners.onPartial(response.partial)
    else if ('final' in response) {
      listeners.onFinal(response.final, response.latencyMs)
    } else if ('dropped' in response) {
      // Not shown: the words are gone either way, and a warning mid-sentence would be noise on
      // top of a machine already struggling. It belongs in the log, where it can be read after.
      log.warn('dictation', `dropped ${response.dropped} samples: the engine is behind`)
    } else fail(new Error(response.failed))
  })

  port.onFailure(error => {
    // A process we killed ourselves still reports its exit, and `utilityProcess` has no way to
    // tell that exit from a crash. Without this the idle unload — which closes the engine on
    // purpose — would surface as `engineCrashed` ten minutes after the last sentence.
    if (closed) return

    closed = true
    fail(error)
  })

  const send = (message: SttMessage): void => {
    if (closed) return
    try {
      port.postMessage(message)
    } catch (error) {
      closed = true
      fail(error instanceof Error ? error : new Error(String(error)))
    }
  }

  return {
    load: request =>
      new Promise((resolve, reject) => {
        if (closed) {
          reject(new Error('the recognition process is gone'))
          return
        }

        settleLoad = { resolve, reject }
        send({ load: true, ...request })
      }),

    push: audio => send({ audio }),
    flush: () => send({ flush: true }),
    cancel: () => send({ cancel: true }),

    close: () => {
      closed = true
      settleLoad = null
      port.kill()
    },
  }
}
