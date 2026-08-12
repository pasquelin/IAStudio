/**
 * The animation band, painted: the ruler, one row per subject or channel, the keys as diamonds,
 * and the head.
 *
 * A canvas rather than the DOM, for the same reason the montage is one: a rig with forty bones
 * keyed every frame is thousands of diamonds, and that many elements is a scroll that stutters.
 * The header column beside it stays DOM, where the controls belong — see `AnimationHeaders`.
 */
import type { Us } from '@shared/domain/time'
import { placeRows } from '../timeline/band'
import { paintRuler, type RulerStyle } from '../timeline/ruler'
import { RULER_HEIGHT, timeToX, type Viewport } from '../timeline/timeline-geometry'
import { memoPalette, rootColour, rootFont } from '../core/palette'
import type { Size } from '../core/geometry'
import type { AnimationRow } from './animation-rows'

const RULER_FAMILY = 'ui-monospace, monospace'

/** `--text-mini` at scale 1, for a paint with no document to read from. */
const RULER_SIZE = '10px'

/** Half the diagonal of a key, in pixels. A diamond reads at this size and crowds beyond it. */
const KEY_REACH = 4

/** A channel's diamonds are drawn smaller than a subject's, as its row is shorter. */
const CHANNEL_REACH = 3

/** How far a block sits inside its row, so two stacked blocks do not read as one. */
const BLOCK_INSET = 2

type Palette = {
  ruler: string
  row: string
  rowAlt: string
  border: string
  key: string
  keySelected: string
  block: string
  beyond: string
  playhead: string
  muted: string
  rulerFont: string
}

const readPalette = memoPalette((): Palette => ({
  ruler: rootColour('--color-chassis'),
  row: rootColour('--color-panel'),
  rowAlt: rootColour('--color-surface'),
  border: rootColour('--color-border'),
  key: rootColour('--color-muted'),
  keySelected: rootColour('--color-accent'),
  block: rootColour('--color-elevated'),
  beyond: rootColour('--color-scrim'),
  playhead: rootColour('--color-accent'),
  muted: rootColour('--color-muted'),
  rulerFont: rootFont('--text-mini', RULER_SIZE, RULER_FAMILY),
}))

export type AnimationPaint = {
  rows: readonly AnimationRow[]
  viewport: Viewport
  fps: number
  duration: Us
  playhead: Us
  /** The keys under a selection, as `<rowId>@<time>`, so a channel and its subject agree. */
  selected: ReadonlySet<string>
}

/** How a key is named in the selection set, and in a hit test. */
export function keyId(rowId: string, time: Us): string {
  return `${rowId}@${time}`
}

/**
 * What a key name holds, or nothing when the string is not one.
 *
 * Beside `keyId` because the two decide ONE format between them. It was read apart, in the panel
 * that deletes a key, and a separator decided in two places is a separator that ends up meaning
 * two things. The LAST `@` is the one that separates: nothing forbids a row id from holding one.
 */
export function keyParts(id: string): { rowId: string; time: Us } | undefined {
  const cut = id.lastIndexOf('@')
  // `cut === 0` is a name with no row before the separator, which no row answers to.
  if (cut <= 0) return undefined

  const written = id.slice(cut + 1)
  const time = Number(written)
  // `Number('')` is 0, which would read a key at the start of the sheet out of `row@`.
  if (written === '' || !Number.isFinite(time)) return undefined

  return { rowId: id.slice(0, cut), time }
}

/** A diamond: a square on its corner, which is what every sheet draws a key as. */
function paintKey(
  context: CanvasRenderingContext2D,
  x: number,
  y: number,
  reach: number,
  colour: string,
): void {
  context.fillStyle = colour
  context.beginPath()
  context.moveTo(x, y - reach)
  context.lineTo(x + reach, y)
  context.lineTo(x, y + reach)
  context.lineTo(x - reach, y)
  context.closePath()
  context.fill()
}

export function keysOf(row: AnimationRow): readonly Us[] {
  if (row.kind === 'subject') return row.keys
  if (row.kind === 'channel') return row.track.keys.map(key => key.time)
  // A block holds no key: it is drawn as a bar — see `paintBlock`.
  return []
}

/**
 * Half a diamond's diagonal on that row, which a hit test needs as much as the paint does. A
 * block draws no diamond at all, so nothing on its row can be grabbed by one.
 */
export function reachOf(row: AnimationRow): number {
  if (row.kind === 'subject') return KEY_REACH
  return row.kind === 'channel' ? CHANNEL_REACH : 0
}

export function paintAnimation(
  context: CanvasRenderingContext2D,
  paint: AnimationPaint,
  size: Size,
): void {
  const palette = readPalette()
  context.clearRect(0, 0, size.width, size.height)

  paintRows(context, paint, size, palette)

  const style: RulerStyle = {
    background: palette.ruler,
    tick: palette.border,
    text: palette.muted,
    font: palette.rulerFont,
  }
  paintRuler(context, { viewport: paint.viewport, width: size.width, fps: paint.fps, style })

  paintBeyond(context, paint, size, palette)
  paintHead(context, paint, size, palette)
}

function paintRows(
  context: CanvasRenderingContext2D,
  paint: AnimationPaint,
  size: Size,
  palette: Palette,
): void {
  for (const { item: row, offset } of placeRows(paint.rows)) {
    const top = RULER_HEIGHT + offset - paint.viewport.scrollTop
    if (top > size.height || top + row.height < RULER_HEIGHT) continue

    context.fillStyle = row.kind === 'subject' ? palette.row : palette.rowAlt
    context.fillRect(0, top, size.width, row.height)

    context.fillStyle = palette.border
    context.fillRect(0, top + row.height - 1, size.width, 1)

    if (row.kind === 'clip') {
      paintBlock(context, row.start, row.duration, top, row.height, paint.viewport, palette)
      continue
    }

    const middle = top + row.height / 2
    const reach = reachOf(row)

    for (const time of keysOf(row)) {
      const x = timeToX(time, paint.viewport)
      if (x < -reach || x > size.width + reach) continue

      const chosen = paint.selected.has(keyId(row.id, time))
      paintKey(context, x, middle, reach, chosen ? palette.keySelected : palette.key)
    }
  }
}

/** A clip, as the bar it is: it has a length, which is the whole difference from a key. */
function paintBlock(
  context: CanvasRenderingContext2D,
  start: Us,
  duration: Us,
  top: number,
  height: number,
  viewport: Viewport,
  palette: Palette,
): void {
  const left = timeToX(start, viewport)
  const right = timeToX(start + duration, viewport)

  context.fillStyle = palette.block
  context.fillRect(left, top + BLOCK_INSET, Math.max(1, right - left), height - BLOCK_INSET * 2 - 1)
}

/**
 * Dims whatever lies past the end of the band.
 *
 * A ruler graduated to seventeen seconds over a five-second scene says the scene is longer than
 * it is, and there is nowhere for a key to go out there — the head is clamped to the duration.
 */
function paintBeyond(
  context: CanvasRenderingContext2D,
  paint: AnimationPaint,
  size: Size,
  palette: Palette,
): void {
  const end = timeToX(paint.duration, paint.viewport)
  if (end >= size.width) return

  context.fillStyle = palette.beyond
  context.fillRect(Math.max(0, end), RULER_HEIGHT, size.width - Math.max(0, end), size.height)
}

function paintHead(
  context: CanvasRenderingContext2D,
  paint: AnimationPaint,
  size: Size,
  palette: Palette,
): void {
  // The half pixel is what keeps a one-pixel rule from being drawn across two.
  const x = Math.round(timeToX(paint.playhead, paint.viewport)) + 0.5
  if (x < 0 || x > size.width) return

  context.fillStyle = palette.playhead
  context.fillRect(x, 0, 1, size.height)
}
