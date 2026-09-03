/**
 * What crosses to the relief sculpt worker and back. Own file so both sides read the same
 * contract — the same reason `csgMessage.ts` exists.
 */
import type {
  PackedReliefChunk,
  ReliefExtent,
  ReliefSculpt,
  ReliefSculptOperation,
} from '@shared/domain/relief'

export type ReliefSculptRequest = {
  id: number
  width: number
  height: number
  extent: ReliefExtent
  grain: number
  sculpt: ReliefSculpt | undefined
  operation: ReliefSculptOperation
}

/**
 * The dirtied chunks in the form the DOCUMENT holds them, base64 and all. Decoding them here to
 * transfer a `Float32Array` cost the worker a decode and the UI thread the re-encode after it,
 * for a payload the surface decodes again to draw — `reliefSculptCost.test.ts`.
 */
export type ReliefSculptResponse =
  | { id: number; ok: true; grain: number; chunks: PackedReliefChunk[] }
  | { id: number; ok: false; error: string }
