import { isRecord, readNumber, readString } from '@shared/guards'
import type { Command } from '@/engines/core/history'
import { CLIP_EDGES, type ClipEdge, type Us } from '@/engines/timeline/timeline-state'
import {
  applyFades,
  applyGain,
  crop,
  DEFAULT_TARGET_LUFS,
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

/**
 * Appends a step, and removes that same step on the way back.
 *
 * The index is captured as the command is applied rather than assumed to be the last one:
 * `history.ts` promises that `revert` undoes its own `apply`, and a blind `slice(0, -1)` would
 * hold only for as long as appending stays the only audio command there is.
 */
export function pushEdit(edit: AudioEdit): Command<AudioEditState> {
  let at = -1

  return {
    id: `audio:${edit.kind}`,
    apply: state => {
      at = state.edits.length
      return { ...state, edits: [...state.edits, edit] }
    },
    revert: state =>
      at < 0 ? state : { ...state, edits: state.edits.filter((_step, index) => index !== at) },
  }
}

export function serializeAudioEdits(state: AudioEditState): string {
  return JSON.stringify(state)
}

/**
 * One step read back. `null` for anything this build cannot replay, and the caller drops it:
 * a chain is replayed in order, so a step that does nothing would silently change what the
 * take sounds like — dropping it says the same thing without pretending to have applied it.
 */
function readEdit(raw: unknown): AudioEdit | null {
  if (!isRecord(raw)) return null

  switch (raw.kind) {
    case 'crop': {
      const from = Math.max(0, readNumber(raw, 'from', 0))
      const to = Math.max(0, readNumber(raw, 'to', 0))
      return to > from ? { kind: 'crop', from, to } : null
    }
    case 'fade': {
      const edge = CLIP_EDGES.find(candidate => candidate === raw.edge)
      const length = Math.max(0, readNumber(raw, 'length', 0))
      return edge ? { kind: 'fade', edge, length } : null
    }
    case 'gain':
      return { kind: 'gain', db: readNumber(raw, 'db', 0) }
    case 'normalize':
      return { kind: 'normalize', targetLufs: readNumber(raw, 'targetLufs', DEFAULT_TARGET_LUFS) }
    case 'trimSilence':
      return { kind: 'trimSilence' }
    default:
      return null
  }
}

function readRegion(raw: unknown): Region | null {
  if (!isRecord(raw)) return null

  const from = Math.max(0, readNumber(raw, 'from', 0))
  const to = Math.max(0, readNumber(raw, 'to', 0))
  // A collapsed region loops over nothing and every tool reading it acts on nothing.
  return to > from ? { from, to } : null
}

/**
 * A chain read back from a file. Takes the parsed value rather than the text, like every other
 * document reader: text that is not JSON at all is a file that failed to read, and that is the
 * caller's to refuse — a shape that is merely wrong opens on an empty chain.
 */
export function parseAudioEdits(content: unknown): AudioEditState {
  if (!isRecord(content)) return EMPTY_AUDIO_EDIT

  const assetId = readString(content, 'assetId', '')
  const edits: AudioEdit[] = []
  if (Array.isArray(content.edits)) {
    for (const entry of content.edits) {
      const edit = readEdit(entry)
      if (edit) edits.push(edit)
    }
  }

  return {
    assetId: assetId || null,
    edits,
    region: readRegion(content.region),
    // Never restored as bypassed: A/B is which of two things one is listening to right now,
    // and a document that reopens on the source would look like a chain that stopped working.
    bypassed: false,
  }
}
