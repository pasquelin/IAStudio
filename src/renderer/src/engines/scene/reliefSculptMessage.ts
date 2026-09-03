/**
 * What crosses to the relief sculpt worker and back. Own file so both sides read the same
 * contract — the same reason `csgMessage.ts` exists.
 */
import type { ReliefExtent, ReliefSculpt, ReliefSculptOperation } from '@shared/domain/relief'

export type ReliefSculptRequest = {
  id: number
  width: number
  height: number
  extent: ReliefExtent
  sculpt: ReliefSculpt | undefined
  operation: ReliefSculptOperation
}

/** One dirtied chunk's after-state deltas. An empty array is a chunk that became all zeroes. */
export type ReliefSculptChunkDelta = {
  column: number
  row: number
  deltas: Float32Array
}

export type ReliefSculptResponse =
  | { id: number; ok: true; grain: number; chunks: ReliefSculptChunkDelta[] }
  | { id: number; ok: false; error: string }

export function transferablesOf(chunks: readonly ReliefSculptChunkDelta[]): Transferable[] {
  return chunks.map(chunk => chunk.deltas.buffer)
}
