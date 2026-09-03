import { adaptiveGeometricRig } from './adaptiveGeometricRig'
import {
  isAdaptiveRigCancel,
  type AdaptiveRigIncoming,
  type AdaptiveRigResponse,
} from './adaptiveRigMessage'

const cancelled = new Set<number>()

self.addEventListener('message', (event: MessageEvent<AdaptiveRigIncoming>) => {
  if (isAdaptiveRigCancel(event.data)) {
    cancelled.add(event.data.id)
    return
  }

  const { id, sample } = event.data
  try {
    const result = adaptiveGeometricRig(sample)
    if (cancelled.delete(id)) return
    const response: AdaptiveRigResponse = { id, done: true, ok: true, result }
    self.postMessage(response)
  } catch (error) {
    if (cancelled.delete(id)) return
    const response: AdaptiveRigResponse = {
      id,
      done: true,
      ok: false,
      error: error instanceof Error ? error.message : String(error),
    }
    self.postMessage(response)
  }
})
