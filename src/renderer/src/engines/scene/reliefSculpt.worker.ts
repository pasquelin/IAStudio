/// <reference lib="webworker" />
import { messageOf } from '@shared/guards'
import {
  applyReliefSculpt,
  changedChunks,
  chunkLayout,
  unpackDeltas,
} from '@shared/domain/relief'
import {
  transferablesOf,
  type ReliefSculptChunkDelta,
  type ReliefSculptRequest,
  type ReliefSculptResponse,
} from './reliefSculptMessage'

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
    const chunks = deltasOf(width, height, sculpt, after)
    self.postMessage(
      { id, ok: true, grain: after.grain, chunks } satisfies ReliefSculptResponse,
      transferablesOf(chunks),
    )
  } catch (error) {
    self.postMessage({ id, ok: false, error: messageOf(error) } satisfies ReliefSculptResponse)
  }
})

function deltasOf(
  width: number,
  height: number,
  before: ReliefSculptRequest['sculpt'],
  after: NonNullable<ReliefSculptRequest['sculpt']>,
): ReliefSculptChunkDelta[] {
  return changedChunks(before, after).map(edit => {
    const layout = chunkLayout(edit.column, edit.row, width, height, after.grain)
    return {
      column: edit.column,
      row: edit.row,
      deltas:
        edit.payload === ''
          ? new Float32Array(0)
          : unpackDeltas(edit.payload, layout.width * layout.height),
    }
  })
}
