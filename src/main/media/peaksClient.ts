import { createProcessClient } from '@main/processClient'
import type { PeaksJob, PeaksMessage, PeaksResponse } from './peaksProtocol'

/**
 * The worker process, reduced to what the client needs. Injected rather than imported so the
 * protocol can be tested without forking anything — `utilityProcess` needs a live app.
 */
export type PeaksPort = {
  postMessage: (message: PeaksMessage) => void
  onMessage: (listener: (response: PeaksResponse) => void) => void
  /** The process died. Whatever it was asked will never be answered. */
  onFailure: (listener: (error: Error) => void) => void
}

export type PeaksRun = PeaksJob & { signal?: AbortSignal }

/** Reduces PCM to a waveform, off this process entirely. */
export type PeaksClient = {
  compute: (run: PeaksRun) => Promise<Float32Array>
}

export function createPeaksClient(port: PeaksPort): PeaksClient {
  const client = createProcessClient<PeaksMessage, PeaksResponse, Float32Array>({
    port,
    runOf: response => response.id,
    read: response =>
      response.ok
        ? { kind: 'settled', result: response.peaks }
        : { kind: 'failed', error: response.error },
    gone: 'the waveform process is gone',
    cancel: id => ({ id, cancel: true }),
  })

  return {
    // No `stopped`: a waveform asked for and stopped before it left is a run that produced
    // nothing, and there is no empty `Float32Array` that means that rather than silence.
    compute: ({ signal, ...job }) => client.send(id => ({ id, ...job }), { signal }),
  }
}
