import { createWorkerPort } from '../core/workerPort'
import type { AdaptiveRigResult } from './adaptiveGeometricRig'
import type { AdaptiveRigRequest, AdaptiveRigResponse } from './adaptiveRigMessage'
import type { MeshSample } from './rigSnap'

export type AdaptiveRigFitter = {
  fit: (sample: MeshSample, signal?: AbortSignal) => Promise<AdaptiveRigResult | null>
  dispose: () => void
}

export function createAdaptiveRigFitter(spawn: () => Worker): AdaptiveRigFitter {
  const port = createWorkerPort<AdaptiveRigResult, AdaptiveRigResponse>(
    spawn,
    'adaptive rig',
    answer => answer.result,
  )

  return {
    fit: (sample, signal) =>
      port.send(
        id => {
          const points = sample.points.slice()
          const message: AdaptiveRigRequest = { id, sample: { bounds: sample.bounds, points } }
          return { message, transfer: [points.buffer] }
        },
        { signal },
      ),
    dispose: port.dispose,
  }
}
