/**
 * Which clips of a model are alive at a given head, at what time inside them, and at what weight.
 *
 * Never `crossFadeTo`: that runs the fade on the mixer's clock, so the pose would depend on how
 * playback reached the instant, and a scrub or a frame-by-frame render would not match it.
 */
import { clipKeyOf, clipLane, type ClipLane, type ClipRef } from '@shared/domain/scene'
import { WHOLE_BODY, type BodyPart } from '@shared/domain/humanoid'
import { secondsToUs, usToSeconds, type Us } from '@shared/domain/time'
import { clamp } from '@shared/numeric'
import type { ClipEdge } from '../timeline/timelineGeometry'

/** A speed of zero would make a block infinitely long; no control in the studio offers less. */
const MIN_SPEED = 0.1

/**
 * How much band a block takes: what the document says, else the file's length at the speed it
 * plays. `0` while the file has not landed — its length lives in the GLB.
 */
export function clipSpanOf(ref: ClipRef, length: number | null): Us {
  if (ref.duration > 0) return ref.duration
  if (length === null || length <= 0) return 0

  return secondsToUs(length / Math.max(ref.speed, MIN_SPEED))
}

/** One block as the mixer has to hold it at one instant. */
export type ClipWeight = {
  clipId: string
  /** The clip of the file this block plays. */
  name: string
  /** Where inside that clip, in three's seconds. */
  time: number
  /** How much of the pose it contributes, 0 to 1. */
  weight: number
}

type Block = { ref: ClipRef; span: Us; length: number }

/**
 * What plays at `playhead`, across every lane. Empty while the file has not landed, never a
 * guessed width.
 *
 * Each lane is resolved on its own — the hold that keeps a lone clip standing belongs to the lane
 * it stands in — and the lanes are then averaged WITHIN a body part: two whole-body moves layered
 * on one another can honestly give no more than their mean, while two halves of a body do not
 * have to give anything up at all.
 */
export function clipBlendAt(
  lanes: readonly ClipLane[],
  lengths: Readonly<Record<string, number>>,
  playhead: Us,
): ClipWeight[] {
  const sounding = new Map<Block, number>()

  for (const lane of lanes) {
    const blocks = placed(lane.clips, lengths)
    if (blocks.length === 0) continue

    const heard = new Map<Block, number>()
    for (const block of blocks) {
      if (covers(block, playhead)) heard.set(block, weightAt(block, playhead))
    }

    const within = [...heard.values()].reduce((sum, weight) => sum + weight, 0)
    // Whatever the fades leave goes to the block that HOLDS here, never to the rest pose: a
    // character melting towards its bind pose is the one thing a fade must never look like.
    if (within < 1) {
      const holder = holdingAt(blocks, playhead)
      heard.set(holder, (heard.get(holder) ?? 0) + 1 - within)
    }

    for (const [block, weight] of heard) sounding.set(block, weight)
  }

  // Shared out WITHIN a body part and not across all of them: two blocks driving different
  // halves are not competing for the same bones, and halving both is what made « walk AND wave »
  // come out as neither.
  const totals = new Map<BodyPart, number>()
  for (const [block, weight] of sounding) {
    const part = block.ref.part ?? WHOLE_BODY
    totals.set(part, (totals.get(part) ?? 0) + weight)
  }

  return [...sounding].map(([block, weight]) => ({
    clipId: block.ref.id,
    name: block.ref.source.name,
    time: clipTimeAt(block.ref, block.length, Math.min(playhead, block.ref.start + block.span)),
    weight: weight / Math.max(1, totals.get(block.ref.part ?? WHOLE_BODY) ?? 1),
  }))
}

/** The blocks that can be drawn at all, earliest first — the order the hold below reads. */
function placed(clips: readonly ClipRef[], lengths: Readonly<Record<string, number>>): Block[] {
  const blocks: Block[] = []

  for (const ref of clips) {
    const length = lengths[clipKeyOf(ref.source)]
    if (length === undefined) continue

    const span = clipSpanOf(ref, length)
    if (span > 0) blocks.push({ ref, span, length })
  }

  return blocks.sort((left, right) => left.ref.start - right.ref.start)
}

/** Half-open, so two blocks laid end to end never both answer for the instant they share. */
function covers(block: Block, playhead: Us): boolean {
  return playhead >= block.ref.start && playhead < block.ref.start + block.span
}

/**
 * Which block answers where none covers the head: the last one to have started, or the first of
 * all before any has. A block HOLDS its edge pose outside itself, as an NLA strip does — that is
 * what keeps a lone clip standing at its first frame before its block and its last one after.
 */
function holdingAt(blocks: readonly Block[], playhead: Us): Block {
  return blocks.reduce((held, block) => (block.ref.start <= playhead ? block : held))
}

/**
 * Rising over `fadeIn` from the start, falling over `fadeOut` into the end, and one between.
 * Deliberately not `timeline/audio`'s `fadeAt`, which is the same five lines for a different job:
 * an ear's fade may go equal-power one day, while these weights have to keep summing to one.
 */
function weightAt(block: Block, playhead: Us): number {
  const { start, fadeIn, fadeOut } = block.ref
  const rising = fadeIn > 0 ? (playhead - start) / fadeIn : 1
  const falling = fadeOut > 0 ? (start + block.span - playhead) / fadeOut : 1

  return clamp(Math.min(rising, falling), 0, 1)
}

/** Where inside a clip the head stands, in the seconds three counts in. */
export function clipTimeAt(ref: ClipRef, length: number, playhead: Us): number {
  // `offset` shifts where the block BITES into the clip: a walk cut to start mid-stride begins at
  // its own first frame on the band and a third of the way through the clip.
  const into = usToSeconds(Math.max(0, playhead - ref.start)) * ref.speed + ref.offset
  if (length <= 0) return 0

  // A clip that loops wraps; one that does not holds its last frame, which is what
  // `clampWhenFinished` promises the moment it finishes.
  return ref.loop ? into % length : Math.min(into, length)
}

/**
 * The lanes rewritten around one of them, or `null` when that lane refuses the edit.
 *
 * Every edit below answers `null` for one that cannot be made, and a refusal must not reach the
 * history: `runCommand` banks whatever it is handed, and ⌘Z would then give back a state nobody
 * ever left.
 */
export function lanesWith(
  lanes: readonly ClipLane[],
  laneId: string,
  change: (clips: readonly ClipRef[]) => readonly ClipRef[] | null,
): readonly ClipLane[] | null {
  const found = lanes.find(lane => lane.id === laneId)
  if (!found) return null

  const clips = change(found.clips)
  return clips ? lanes.map(lane => (lane.id === laneId ? { ...lane, clips } : lane)) : null
}

/**
 * A lane added at the end. What a caller hands in is what it SEES: the lanes a model shows are
 * not always the ones the document holds — one is derived for a model that never played anything.
 */
export function lanesPlus(lanes: readonly ClipLane[], id: string): readonly ClipLane[] {
  return [...lanes, clipLane(id)]
}

/**
 * The lanes without that one. The LAST is kept whatever is asked: an object's track is where an
 * animation is dropped, and one with no lane left has nowhere to receive the next.
 */
export function lanesMinus(lanes: readonly ClipLane[], id: string): readonly ClipLane[] | null {
  if (lanes.length <= 1 || !lanes.some(lane => lane.id === id)) return null

  return lanes.filter(lane => lane.id !== id)
}

/** One lane moved by `by` places, clamped at both ends rather than wrapping. */
export function lanesMoved(
  lanes: readonly ClipLane[],
  id: string,
  by: number,
): readonly ClipLane[] | null {
  const at = lanes.findIndex(lane => lane.id === id)
  const to = Math.min(Math.max(at + by, 0), lanes.length - 1)
  if (at === -1 || to === at) return null

  const next = [...lanes]
  next.splice(to, 0, ...next.splice(at, 1))
  return next
}

/** The block that answers to this id, with the list rewritten around it. */
function rewritten(
  clips: readonly ClipRef[],
  clipId: string,
  change: (clip: ClipRef) => ClipRef | null,
): readonly ClipRef[] | null {
  const found = clips.find(clip => clip.id === clipId)
  if (!found) return null

  const next = change(found)
  return next ? clips.map(clip => (clip.id === clipId ? next : clip)) : null
}

/** Slides one block along the band, keeping what it plays and leaving its neighbours put. */
export function clipsMoved(
  clips: readonly ClipRef[],
  clipId: string,
  start: Us,
): readonly ClipRef[] | null {
  const at = Math.max(0, start)
  return rewritten(clips, clipId, clip => (clip.start === at ? null : { ...clip, start: at }))
}

/**
 * Drags one edge of a block. `length` is how long the clip runs in the file, in three's seconds,
 * or `null` while it has not landed — the band knows it and the document does not.
 */
export function clipsTrimmed(
  clips: readonly ClipRef[],
  clipId: string,
  edge: ClipEdge,
  at: Us,
  length: number | null,
): readonly ClipRef[] | null {
  return rewritten(clips, clipId, clip => {
    const span = clipSpanOf(clip, length)
    if (span <= 0) return null
    return edge === 'out' ? trimmedOut(clip, at, span) : trimmedIn(clip, at, span, length)
  })
}

/**
 * The out edge has NO upper bound, and that is where an animation parts from a rush: pulled past
 * what the clip holds, a looping block plays it again and one that does not holds its last pose.
 */
function trimmedOut(clip: ClipRef, at: Us, span: Us): ClipRef | null {
  const duration = at - clip.start
  // Snapped to the frame, a drag lands on the width it already has three times out of four; an
  // entry banked for that is an undo the eye cannot see.
  if (duration <= 0 || duration === span) return null

  return { ...clip, duration, fadeOut: Math.min(clip.fadeOut, duration) }
}

/**
 * The in edge bites further into the clip, so what it plays follows the edge rather than sliding
 * under it. Two geometries, not one with a flag: a looping block may be pulled back for ever and
 * simply comes round again, while one that does not loop has nothing before its first frame.
 */
function trimmedIn(clip: ClipRef, at: Us, span: Us, length: number | null): ClipRef | null {
  const wrap = clip.loop && length !== null && length > 0 ? length : null
  const floor = wrap === null ? Math.max(0, clip.start - secondsToUs(clip.offset / clip.speed)) : 0

  const start = Math.max(at, floor)
  const duration = clip.start + span - start
  if (duration <= 0 || start === clip.start) return null

  const shifted = clip.offset + usToSeconds(start - clip.start) * clip.speed
  const offset = wrap === null ? Math.max(0, shifted) : ((shifted % wrap) + wrap) % wrap
  return { ...clip, start, duration, offset, fadeIn: Math.min(clip.fadeIn, duration) }
}

export function clipsWithout(clips: readonly ClipRef[], clipId: string): readonly ClipRef[] | null {
  return clips.some(clip => clip.id === clipId) ? clips.filter(clip => clip.id !== clipId) : null
}
