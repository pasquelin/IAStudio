import type { Command } from '@/engines/core/history'
import type { ClipEdge, Us } from '@/engines/timeline/timeline-state'
import {
  applyFades,
  applyGain,
  crop,
  durationOf,
  normalize,
  trimSilence,
  type AudioData,
} from './audio-data'

/**
 * One step of the chain. Kept as an instruction rather than as the samples it produces: a
 * three-minute take is seventy megabytes, and an undo stack of those would be gigabytes for
 * five clicks. The chain is replayed from the source instead, which is also what makes A/B a
 * boolean rather than a second copy.
 */
export type AudioEdit =
  | { kind: 'crop'; from: Us; to: Us }
  | { kind: 'fade'; edge: ClipEdge; length: Us }
  | { kind: 'gain'; db: number }
  | { kind: 'normalize'; targetLufs: number }
  | { kind: 'trimSilence' }

export type Region = { from: Us; to: Us }

export type AudioEditState = {
  /** What is being edited. Null until a tab is pointed at an asset. */
  assetId: string | null
  edits: AudioEdit[]
  /** The stretch the transport loops over and the tools act on. */
  region: Region | null
  /** A/B: hear the source rather than the chain, without undoing anything. */
  bypassed: boolean
}

export const EMPTY_AUDIO_EDIT: AudioEditState = {
  assetId: null,
  edits: [],
  region: null,
  bypassed: false,
}

/**
 * The take as the chain leaves it. Pure, and replayed from the source every time: that is what
 * makes every step reversible without keeping a buffer per step.
 */
export function renderEdits(source: AudioData, edits: readonly AudioEdit[]): AudioData {
  return edits.reduce((data, edit) => {
    switch (edit.kind) {
      case 'crop':
        return crop(data, edit.from, edit.to)
      case 'fade':
        return edit.edge === 'in'
          ? applyFades(data, edit.length, 0)
          : applyFades(data, 0, edit.length)
      case 'gain':
        return applyGain(data, edit.db)
      case 'normalize':
        return normalize(data, edit.targetLufs)
      case 'trimSilence':
        return trimSilence(data)
    }
  }, source)
}

/** What the editor plays: the chain, or the source when A/B is held on the source side. */
export function audibleData(source: AudioData, state: AudioEditState): AudioData {
  return state.bypassed ? source : renderEdits(source, state.edits)
}

/** A region clamped to the take it belongs to, or nothing when it has collapsed. */
export function clampRegion(region: Region, data: AudioData): Region | null {
  const total = durationOf(data)
  const from = Math.max(0, Math.min(total, region.from))
  const to = Math.max(from, Math.min(total, region.to))
  return to > from ? { from, to } : null
}

/** Appends a step. Undo drops it again — the chain is the whole of the state. */
export function pushEdit(edit: AudioEdit): Command<AudioEditState> {
  return {
    id: `audio:${edit.kind}`,
    apply: state => ({ ...state, edits: [...state.edits, edit] }),
    revert: state => ({ ...state, edits: state.edits.slice(0, -1) }),
  }
}
