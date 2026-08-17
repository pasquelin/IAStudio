import { handleRequest, type AudioWorkerRequest, type AudioWorkerState } from './audioRender'

/**
 * The audio chain, off the window's thread. Wiring only — the arithmetic and the ownership
 * rules live in `handleRequest`, which is testable without a worker.
 */
const state: AudioWorkerState = { source: null }

self.onmessage = (event: MessageEvent<AudioWorkerRequest>): void => {
  const answer = handleRequest(state, event.data)
  // Through the options object rather than the bare array: `self` is typed as a window here,
  // and only this overload is shared by both global scopes.
  if (answer) self.postMessage(answer.response, { transfer: answer.transfer })
}
