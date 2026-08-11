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
import { onPaletteChange, token, tokenAsFont } from '../core/palette'
import type { AnimationRow } from './animation-rows'

export type Size = { width: number; height: number }

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
  playhead: string
  muted: string
  rulerFont: string
}

let cached: Palette | null = null

function readPalette(): Palette {
  if (cached) return cached
  cached = computePalette()
  return cached
}

/** Called when the theme changes; the next paint reads the tokens again. */
export function forgetAnimationPalette(): void {
  cached = null
}

onPaletteChange(forgetAnimationPalette)

function computePalette(): Palette {
  const root = typeof document === 'undefined' ? null : document.documentElement
  const read = (name: string): string => (root ? token(root, name) : '') || '#000'

  return {
    ruler: read('--color-chassis'),
    row: read('--color-panel'),
    rowAlt: read('--color-surface'),
    border: read('--color-border'),
    key: read('--color-muted'),
    keySelected: read('--color-accent'),
    block: read('--color-elevated'),
    playhead: read('--color-accent'),
    muted: read('--color-muted'),
    rulerFont: root
      ? tokenAsFont(root, '--text-mini', RULER_SIZE, RULER_FAMILY)
      : `${RULER_SIZE} ${RULER_FAMILY}`,
  }
}

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

/** Half a diamond's diagonal on that row, which a hit test needs as much as the paint does. */
export function reachOf(row: AnimationRow): number {
  return row.kind === 'subject' ? KEY_REACH : CHANNEL_REACH
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
