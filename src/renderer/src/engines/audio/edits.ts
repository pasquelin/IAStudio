import { isRecord, readNumber, readPositive, readString } from '@shared/guards'
import { clamp } from '@shared/numeric'
import type { Command } from '@/engines/core/history'
import { CLIP_EDGES, type ClipEdge, type Us } from '@/engines/timeline/timeline-state'
import {
  applyFades,
  applyGain,
  crop,
  DEFAULT_TARGET_LUFS,
  durationOf,
  rms,
  silentBounds,
  toDb,
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

/** What one block of the montage has been asked for, over the take it holds. */
export type TakeChain = {
  edits: AudioEdit[]
  /** The stretch the transport loops over and the tools act on. */
  region: Region | null
  /** A/B: hear the source rather than the chain, without undoing anything. */
  bypassed: boolean
}

export const EMPTY_TAKE_CHAIN: TakeChain = { edits: [], region: null, bypassed: false }

/**
 * Every chain of a document, keyed by the montage BLOCK it edits.
 *
 * Per block and not per document, because that is what the editor below the montage shows: the
 * block one selected, exactly as the Video workspace's source monitor shows the clip one
 * selected. A chain held per document made the two halves argue — the strip showed several
 * blocks and the editor showed a take that had been loaded from the shelf, with nothing on
 * screen tying one to the other.
 *
 * The block also carries what the chain USED to hold beside it: which asset is being edited is
 * `clip.assetId`, and which clip the chain writes back to is the key itself.
 */
export type AudioEditState = {
  chains: Record<string, TakeChain>
}

export const EMPTY_AUDIO_EDIT: AudioEditState = { chains: {} }

/** The chain of one block, or an empty one — a block nobody has edited yet has no entry. */
export function chainOf(state: AudioEditState, clipId: string | null): TakeChain {
  return (clipId ? state.chains[clipId] : null) ?? EMPTY_TAKE_CHAIN
}

/** The same chain written back, out of the history — a region moved, an A/B pressed. */
export function withChain(state: AudioEditState, clipId: string, chain: TakeChain): AudioEditState {
  return { chains: { ...state.chains, [clipId]: chain } }
}

/**
 * The chain expressed as a montage clip: where it starts in the source, how long it runs, its
 * two ramps and its level.
 *
 * Everything here is in SOURCE coordinates, because that is what a clip holds — it points at the
 * file on disk and takes a slice of it. Which is also why the projection is worth having at all:
 * the strip then plays what the editor plays, rather than merely looking like it.
 */
export type TakeShape = {
  inPoint: Us
  duration: Us
  fadeIn: Us
  fadeOut: Us
  gain: number
}

/** What a crop leaves of a shape — bounds moved, and of each ramp only the part still inside. */
function cropShape(shape: TakeShape, from: Us, to: Us): TakeShape {
  // Clamped as `crop` clamps, so the projection cannot describe a slice the samples do not have.
  const start = clamp(from, 0, shape.duration)
  const end = clamp(to, start, shape.duration)

  return {
    ...shape,
    inPoint: shape.inPoint + start,
    duration: end - start,
    fadeIn: Math.max(0, shape.fadeIn - start),
    fadeOut: Math.max(0, shape.fadeOut - (shape.duration - end)),
  }
}

/**
 * The chain replayed, and the shape it comes to, in one pass.
 *
 * Two of the five steps cannot be projected from the instruction alone — `normalize` is a level
 * measured on what reaches it, and `trimSilence` a pair of bounds found in the samples. Rejoining
 * the two answers here is what keeps the strip honest without a second walk over the take.
 *
 * **Where the projection stops being exact**: a ramp already burnt into the samples by an earlier
 * `fade`, then cut into by a later `crop`. A clip holds one ramp length per edge, so what it can
 * say is what is left of that ramp — the audible curve inside the cut is not expressible. The
 * editor stays the truth; the clip approaches it in that one composed case.
 */
export function replayEdits(
  source: AudioData,
  edits: readonly AudioEdit[],
): { data: AudioData; shape: TakeShape } {
  let shape: TakeShape = {
    inPoint: 0,
    duration: durationOf(source),
    fadeIn: 0,
    fadeOut: 0,
    gain: 0,
  }

  const data = edits.reduce((current, edit) => {
    switch (edit.kind) {
      case 'crop':
        shape = cropShape(shape, edit.from, edit.to)
        return crop(current, edit.from, edit.to)
      case 'fade':
        // The last one wins, where the samples would carry both: a clip holds one length per
        // edge, and two fades on the same edge is a gesture nobody makes twice on purpose.
        shape =
          edit.edge === 'in'
            ? { ...shape, fadeIn: edit.length }
            : { ...shape, fadeOut: edit.length }
        return edit.edge === 'in'
          ? applyFades(current, edit.length, 0)
          : applyFades(current, 0, edit.length)
      case 'gain':
        shape = { ...shape, gain: shape.gain + edit.db }
        return applyGain(current, edit.db)
      case 'normalize': {
        // The level is measured once and spent twice — on the shape and on the samples. Calling
        // `normalize` here would walk every sample a second time only to find it again, and this
        // runs on a take of eight million of them.
        const level = toDb(rms(current))
        if (!Number.isFinite(level)) return current

        const db = edit.targetLufs - level
        shape = { ...shape, gain: shape.gain + db }
        return applyGain(current, db)
      }
      case 'trimSilence': {
        const total = durationOf(current)
        const { head, tail } = silentBounds(current)
        if (head === 0 && tail === total) return current

        shape = cropShape(shape, head, tail)
        return crop(current, head, tail)
      }
    }
  }, source)

  return { data, shape }
}

/**
 * The take as the chain leaves it. Pure, and replayed from the source every time: that is what
 * makes every step reversible without keeping a buffer per step.
 */
export function renderEdits(source: AudioData, edits: readonly AudioEdit[]): AudioData {
  return replayEdits(source, edits).data
}

/** What the editor plays: the chain, or the source when A/B is held on the source side. */
export function audibleData(source: AudioData, chain: TakeChain): AudioData {
  return chain.bypassed ? source : renderEdits(source, chain.edits)
}

/** A region clamped to the take it belongs to, or nothing when it has collapsed. */
export function clampRegion(region: Region, data: AudioData): Region | null {
  const total = durationOf(data)
  // Not `clamp`: `durationOf` divides by a sample rate, so a negative total is not ruled out by
  // the expression itself, and `clamp` would then answer that negative bound instead of zero.
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
export function pushEdit(clipId: string, edit: AudioEdit): Command<AudioEditState> {
  let at = -1

  return {
    id: `audio:${edit.kind}`,
    apply: state => {
      const chain = chainOf(state, clipId)
      at = chain.edits.length
      return withChain(state, clipId, { ...chain, edits: [...chain.edits, edit] })
    },
    revert: state => {
      if (at < 0) return state

      const chain = chainOf(state, clipId)
      return withChain(state, clipId, {
        ...chain,
        edits: chain.edits.filter((_step, index) => index !== at),
      })
    },
  }
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
      const from = readPositive(raw, 'from', 0)
      const to = readPositive(raw, 'to', 0)
      return to > from ? { kind: 'crop', from, to } : null
    }
    case 'fade': {
      const edge = CLIP_EDGES.find(candidate => candidate === raw.edge)
      const length = readPositive(raw, 'length', 0)
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

  const from = readPositive(raw, 'from', 0)
  const to = readPositive(raw, 'to', 0)
  // A collapsed region loops over nothing and every tool reading it acts on nothing.
  return to > from ? { from, to } : null
}

/**
 * A chain read back from a file. Takes the parsed value rather than the text, like every other
 * document reader: text that is not JSON at all is a file that failed to read, and that is the
 * caller's to refuse — a shape that is merely wrong opens on an empty chain.
 */
function readChain(raw: unknown): TakeChain {
  const edits: AudioEdit[] = []
  if (isRecord(raw) && Array.isArray(raw.edits)) {
    for (const entry of raw.edits) {
      const edit = readEdit(entry)
      if (edit) edits.push(edit)
    }
  }

  return {
    edits,
    region: readRegion(isRecord(raw) ? raw.region : null),
    // Never restored as bypassed: A/B is which of two things one is listening to right now,
    // and a document that reopens on the source would look like a chain that stopped working.
    bypassed: false,
  }
}

export function parseAudioEdits(content: unknown): AudioEditState {
  if (!isRecord(content)) return EMPTY_AUDIO_EDIT

  if (isRecord(content.chains)) {
    const chains: Record<string, TakeChain> = {}
    for (const [clipId, raw] of Object.entries(content.chains)) chains[clipId] = readChain(raw)
    return { chains }
  }

  /*
   * A document saved while the chain belonged to the DOCUMENT rather than to a block. Its one
   * chain names the block it was laid down as, and that block is where it now lives — read any
   * other way, a project reopened after this change would come back with its fades undone.
   *
   * A chain with no block has nowhere to land: those were saved before the montage held the take
   * at all, and the editor now edits blocks. The take itself is not lost — it is an asset, and
   * the montage is read from its own half of the file.
   */
  const takeClipId = readString(content, 'takeClipId', '')
  return takeClipId ? { chains: { [takeClipId]: readChain(content) } } : EMPTY_AUDIO_EDIT
}
