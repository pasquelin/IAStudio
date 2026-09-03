/// <reference lib="webworker" />
import { messageOf } from '@shared/guards'
import { applyReliefSculpt, changedChunks } from '@shared/domain/relief'
import type { ReliefSculptRequest, ReliefSculptResponse } from './reliefSculptMessage'

declare const self: DedicatedWorkerGlobalScope

/**
 * raiseDisk never reads sample values — a mask that will can take a transferable grid later
 * without changing this adapter.
 */
const NO_VALUES = new Float32Array(0)

self.addEventListener('message', (event: MessageEvent<ReliefSculptRequest>) => {
  const { id, width, height, extent, sculpt, operation } = event.data

  try {
    const after = applyReliefSculpt({ width, height, values: NO_VALUES }, extent, sculpt, operation)
    const chunks = changedChunks(sculpt, after)
    self.postMessage({ id, ok: true, grain: after.grain, chunks } satisfies ReliefSculptResponse)
  } catch (error) {
    self.postMessage({ id, ok: false, error: messageOf(error) } satisfies ReliefSculptResponse)
  }
})
