import { isRecord, readNumber, readPositive, readString } from '@shared/guards'
import { clamp } from '@shared/numeric'
import type { Command } from '@/engines/core/history'
import {
  CLIP_EDGES,
  clipById,
  clipEnd,
  sourceTimeAt,
  type Clip,
  type ClipEdge,
  type SequenceState,
  type Us,
} from '@/engines/timeline/timeline-state'
import {
  applyFades,
  applyGain,
  crop,
  DEFAULT_TARGET_LUFS,
  durationOf,
  rms,
  toDb,
  type AudioData,
} from './audio-data'

/**
 * One step of the chain. Kept as an instruction rather than as the samples it produces: a
 * three-minute take is seventy megabytes, and an undo stack of those would be gigabytes for
 * five clicks. The chain is replayed from the source instead, which is also what makes A/B a
 * boolean rather than a second copy.
 *
 * Nothing here moves the block's BOUNDS, and that is what keeps the chain replayable. A step
 * that cut — the old `crop` and `trimSilence` — was projected onto the block, and the block is
 * where the next replay reads its slice from: the cut then landed on its own result, again on
 * every render. Cutting is a montage gesture, and it is written as one — see `trimTakeClip`.
 */
export type AudioEdit =
  | { kind: 'fade'; edge: ClipEdge; length: Us }
  | { kind: 'gain'; db: number }
  | { kind: 'normalize'; targetLufs: number }

export type Region = { from: Us; to: Us }

/** What one block of the montage has been asked for, over the take it holds. */
export type TakeChain = {
  edits: AudioEdit[]
  /** The stretch the transport loops over and the tools act on. */
  region: Region | null
  /** A/B: hear the source rather than the chain, without undoing anything. */
  bypassed: boolean
  /**
   * Whether a TOOL has ever run on this block — what says the chain may write its ramps and its
   * level onto the clip.
   *
   * Said outright rather than read off the presence of an entry in `chains`, which is what this
   * replaced: dragging a region writes an entry too, and a region is where one is LOOKING. A
   * block whose chain is empty projects no ramp and no level, so one drag on the wave was enough
   * to wipe a fade laid by hand on the strip. A count of steps is the wrong question in the other
   * direction: a chain empties on purpose, and the block has to be laid flat with it.
   */
  touched: boolean
}

export const EMPTY_TAKE_CHAIN: TakeChain = {
  edits: [],
  region: null,
  bypassed: false,
  touched: false,
}

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
 * Only the chains of blocks the montage still holds — what goes to the FILE, never to the store.
 *
 * Nothing prunes when a block is deleted, and that is on purpose: ⌘Z has to give a deleted block
 * its settings back, and a chain dropped with it would come back empty. Saving is where a block
 * is gone for good, so it is where the file stops carrying it. Left in, a long session leaves a
 * document growing without bound behind chains nothing on screen can reach.
 */
export function chainsOnMontage(state: AudioEditState, montage: SequenceState): AudioEditState {
  // `clipById` rather than an index of our own: it is how the whole repository asks this
  // question, and there are as many chains as blocks — saving is not a hot path.
  const kept = Object.entries(state.chains).filter(([clipId]) => clipById(montage, clipId))

  return kept.length === Object.keys(state.chains).length
    ? state
    : { chains: Object.fromEntries(kept) }
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

/**
 * The stretch of a take one block shows — where the chain is replayed FROM.
 *
 * Bounds only, and that is the point: the chain PRODUCES the ramps and the level, and
 * `writeTakeClip` writes them onto the block. Were they read back here, every render would start
 * from its own last answer — a chain holding one +3 dB step would hand the strip 3, then 6, then
 * 9. The bounds are safe from that because no step moves them any more, which is the whole reason
 * cutting became a montage gesture.
 *
 * What it costs, said plainly: a ramp or a level laid by HAND on the strip is still overwritten
 * by the first tool used on that block. Only the trim survives.
 */
export type TakeBounds = { inPoint: Us; duration: Us }

/**
 * `duration` is SOURCE time where a clip holds timeline time, the two differing by the speed it
 * runs at. Through `sourceTimeAt`, which is where that conversion lives and which rounds — a
 * fractional speed otherwise sends `crop` a duration in fractional microseconds.
 */
export function takeSliceOf(clip: Clip): TakeBounds {
  return { inPoint: clip.inPoint, duration: sourceTimeAt(clip, clipEnd(clip)) - clip.inPoint }
}

/**
 * The stretch `[from, to)` OF a slice, back in the take's own coordinates — what the two cutting
 * tools land on the block.
 *
 * Bounds alone, like the slice it narrows: what a cut does to a ramp is `clampFades`' business,
 * on the clip, where the ramps actually live.
 */
export function cropBounds(slice: TakeBounds, from: Us, to: Us): TakeBounds {
  // Clamped as `crop` clamps, so this cannot describe a stretch the samples do not have.
  const start = clamp(from, 0, slice.duration)
  const end = clamp(to, start, slice.duration)

  return { inPoint: slice.inPoint + start, duration: end - start }
}

/** The samples one block shows, without copying a file the block happens to cover whole. */
function sliceOf(source: AudioData, slice: TakeBounds): AudioData {
  const covered = slice.inPoint <= 0 && slice.duration >= durationOf(source)
  return covered ? source : crop(source, slice.inPoint, slice.inPoint + slice.duration)
}

/**
 * The chain replayed over the BLOCK's slice, and the shape it comes to, in one pass.
 *
 * `start` is the block as the montage holds it, and everything begins there: the file behind a
 * block is longer than the block, and replaying from the whole of it handed the strip a shape
 * describing the entire take — one gain was enough to undo a trim laid by hand on the strip.
 *
 * `normalize` cannot be projected from the instruction alone: it is a level measured on whatever
 * reaches it. Rejoining that answer with the shape here is what keeps the strip honest without a
 * second walk over the take.
 */
export function replayEdits(
  source: AudioData,
  edits: readonly AudioEdit[],
  start: TakeBounds,
): { data: AudioData; shape: TakeShape } {
  let shape: TakeShape = { ...start, fadeIn: 0, fadeOut: 0, gain: 0 }

  // A block covering the whole file is handed the file: `crop` allocates even for the full
  // range, and that is seventy megabytes memcpy'd for nothing on every open of a document.
  // `handleRequest` is what keeps the source from being transferred away in that case.
  const slice = sliceOf(source, start)

  const data = edits.reduce((current, edit) => {
    switch (edit.kind) {
      case 'fade':
        // The last one wins, where the samples would carry both: a clip holds one length per
        // edge, and two fades on the same edge is a gesture nobody makes twice on purpose.
        shape =
          edit.edge === 'in'
            ? { ...shape, fadeIn: edit.length }
            : { ...shape, fadeOut: edit.length }
        return current
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
    }
  }, slice)

  // Both ramps laid once, at the end, from the lengths the shape came to — where each `fade`
  // used to burn its own into the samples as it arrived. A clip carries one length per edge and
  // so does this, so the samples can no longer hold a curve the strip has no way to describe.
  return { data: applyFades(data, shape.fadeIn, shape.fadeOut), shape }
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
 *
 * `touched` is not put back on the way out, and that is deliberate: undoing the last step has to
 * lay the block flat again, which is exactly what an empty chain projects.
 */
export function pushEdit(clipId: string, edit: AudioEdit): Command<AudioEditState> {
  let at = -1

  return {
    id: `audio:${edit.kind}`,
    apply: state => {
      const chain = chainOf(state, clipId)
      at = chain.edits.length
      return withChain(state, clipId, {
        ...chain,
        edits: [...chain.edits, edit],
        touched: true,
      })
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
 *
 * `crop` and `trimSilence` were steps until cutting became a montage gesture, and they are
 * dropped here on purpose rather than converted. There is nothing to convert: what they cut is
 * already in the BLOCK's bounds, written there by the very projection that ran on every render.
 * A file saved before the change reopens on the slice it was saved showing.
 */
function readEdit(raw: unknown): AudioEdit | null {
  if (!isRecord(raw)) return null

  switch (raw.kind) {
    case 'fade': {
      const edge = CLIP_EDGES.find(candidate => candidate === raw.edge)
      const length = readPositive(raw, 'length', 0)
      return edge ? { kind: 'fade', edge, length } : null
    }
    case 'gain':
      return { kind: 'gain', db: readNumber(raw, 'db', 0) }
    case 'normalize':
      return { kind: 'normalize', targetLufs: readNumber(raw, 'targetLufs', DEFAULT_TARGET_LUFS) }
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
    // Read as a fact rather than trusted from the file, which would let a document written
    // before the field existed reopen able to flatten a block nobody had tooled. A chain
    // emptied by "apply" reopens as flat too, and its block is already flat on the strip.
    touched: edits.length > 0,
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
