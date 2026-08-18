/**
 * Which clips of a model are alive at a given head, at what time inside them, and at what weight.
 *
 * Never `crossFadeTo`: that runs the fade on the mixer's clock, so the pose would depend on how
 * playback reached the instant, and a scrub or a frame-by-frame render would not match it.
 */
import type { ClipRef } from '@shared/domain/scene'
import { secondsToUs, usToSeconds, type Us } from '@shared/domain/time'
import { clamp } from '@shared/numeric'

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

/** What plays at `playhead`. Empty while the file has not landed, never a guessed width. */
export function clipBlendAt(
  clips: readonly ClipRef[],
  lengths: Readonly<Record<string, number>>,
  playhead: Us,
): ClipWeight[] {
  const blocks = placed(clips, lengths)
  if (blocks.length === 0) return []

  const sounding = new Map<Block, number>()
  for (const block of blocks) {
    if (covers(block, playhead)) sounding.set(block, weightAt(block, playhead))
  }

  const total = [...sounding.values()].reduce((sum, weight) => sum + weight, 0)
  // Whatever the fades leave goes to the block that HOLDS here, never to the rest pose: a
  // character melting towards its bind pose is the one thing a fade must never look like. Two
  // blocks that overlap already sum to one and take nothing; two laid end to end simply cut.
  if (total < 1) {
    const holder = holdingAt(blocks, playhead)
    sounding.set(holder, (sounding.get(holder) ?? 0) + 1 - total)
  }
  const scale = total > 1 ? 1 / total : 1

  return [...sounding].map(([block, weight]) => ({
    clipId: block.ref.id,
    name: block.ref.source.name,
    time: clipTimeAt(block.ref, block.length, Math.min(playhead, block.ref.start + block.span)),
    weight: weight * scale,
  }))
}

/** The blocks that can be drawn at all, earliest first — the order the hold below reads. */
function placed(clips: readonly ClipRef[], lengths: Readonly<Record<string, number>>): Block[] {
  const blocks: Block[] = []

  for (const ref of clips) {
    const length = lengths[ref.source.name]
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
