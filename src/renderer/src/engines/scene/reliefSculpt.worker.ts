/// <reference lib="webworker" />
import { messageOf } from '@shared/guards'
import { applyReliefSculpt, changedChunks } from '@shared/domain/relief'
import type { ReliefSculptRequest, ReliefSculptResponse } from './reliefSculptMessage'

declare const self: DedicatedWorkerGlobalScope

/**
 * raiseDisk never reads sample values. Smooth and flatten send the grid on the request;
 * absent, this empty field keeps the historical raiseDisk path.
 */
const NO_VALUES = new Float32Array(0)

self.addEventListener('message', (event: MessageEvent<ReliefSculptRequest>) => {
  const { id, width, height, extent, grain, sculpt, operation, rows, values, overlays } = event.data

  try {
    const after = applyReliefSculpt(
      { width, height, values: values ?? NO_VALUES },
      extent,
      sculpt,
      operation,
      grain,
      rows,
      overlays,
    )
    const chunks = changedChunks(sculpt, after)
    self.postMessage({ id, ok: true, grain, chunks } satisfies ReliefSculptResponse)
  } catch (error) {
    self.postMessage({ id, ok: false, error: messageOf(error) } satisfies ReliefSculptResponse)
  }
})
