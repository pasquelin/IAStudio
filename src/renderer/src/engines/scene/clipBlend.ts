/**
 * Which clips of a model are alive at a given head, at what time inside them, and at what weight.
 *
 * A PURE FUNCTION OF THE HEAD, and that is the whole design: three's own `crossFadeTo` runs a
 * fade on the mixer's clock, so the pose at a given instant would depend on how playback reached
 * it — a scrub backwards, or a frame-by-frame render, would not match what was played. Working
 * the weights out from the head alone makes `seek` deterministic by construction rather than by
 * chasing it afterwards.
 */
import type { ClipRef } from '@shared/domain/scene'
import { secondsToUs, usToSeconds, type Us } from '@shared/domain/time'

/** A speed of zero would make a block infinitely long; no control in the studio offers less. */
const MIN_SPEED = 0.1

/**
 * How much band a block takes.
 *
 * What the document says when it says anything, and otherwise what the file measures at the speed
 * it plays. `0` while the file has not landed: its length lives in the GLB, and a block of no
 * width is one nothing can be read off yet.
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
 * What plays at `playhead`, blocks in the order the document holds them.
 *
 * Empty for a model whose file has not landed — never a pose taken from a width nobody measured.
 */
export function clipBlendAt(
  clips: readonly ClipRef[],
  lengths: Readonly<Record<string, number>>,
  playhead: Us,
): ClipWeight[] {
  const blocks = placed(clips, lengths)
  if (blocks.length === 0) return []

  const live = blocks.filter(block => covers(block, playhead))
  const sounding =
    live.length > 0
      ? live.map(block => ({ block, weight: fadeAt(block, playhead) }))
      : [{ block: holdingAt(blocks, playhead), weight: 1 }]

  // Scaled down only when they exceed one whole pose: a single block fading in has to rise FROM
  // the rest pose, while two that overlap have to add up to exactly one or the character shrinks
  // towards its rest for the length of the fade.
  const total = sounding.reduce((sum, entry) => sum + entry.weight, 0)
  const scale = total > 1 ? 1 / total : 1

  return sounding.map(({ block, weight }) => ({
    clipId: block.ref.id,
    name: block.ref.source.name,
    time: clipTimeAt(block.ref, block.length, insideBlock(block, playhead)),
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
 * all before any has.
 *
 * A block HOLDS its edge pose outside itself, as an NLA strip does by default — it is what makes
 * a lone clip stand at its first frame before its block and at its last one after, which is what
 * a single-clip document has always done.
 */
function holdingAt(blocks: readonly Block[], playhead: Us): Block {
  return blocks.reduce((held, block) => (block.ref.start <= playhead ? block : held))
}

function insideBlock(block: Block, playhead: Us): Us {
  return Math.min(Math.max(playhead, block.ref.start), block.ref.start + block.span)
}

/** Rising over `fadeIn` from the start, falling over `fadeOut` into the end, and one between. */
function fadeAt(block: Block, playhead: Us): number {
  const { start, fadeIn, fadeOut } = block.ref
  const rising = fadeIn > 0 ? (playhead - start) / fadeIn : 1
  const falling = fadeOut > 0 ? (start + block.span - playhead) / fadeOut : 1

  return Math.max(0, Math.min(1, rising, falling))
}

/**
 * Where inside a clip the head stands, in the seconds three counts in.
 *
 * Held apart from the mixer so it can be tested without one: everything that can go wrong here —
 * a head before the block, a looping clip, a speed — is arithmetic.
 */
export function clipTimeAt(ref: ClipRef, length: number, playhead: Us): number {
  // `offset` shifts where the block bites into the clip: a walk cut to start mid-stride begins
  // at its own first frame on the band and a third of the way through the clip.
  const into = usToSeconds(Math.max(0, playhead - ref.start)) * ref.speed + ref.offset
  if (length <= 0) return 0

  // A clip that loops wraps; one that does not holds its last frame, which is what
  // `clampWhenFinished` promises the moment it finishes.
  return ref.loop ? into % length : Math.min(into, length)
}
