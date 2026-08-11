import {
  CLIP_INSET,
  RULER_HEIGHT,
  timeToX,
  trackRows,
  visibleRange,
  type Viewport,
} from './timeline-geometry'
import { formatTimecode } from './timecode'
import {
  clipEnd,
  frameDuration,
  type Clip,
  type SequenceState,
  type Track,
  type Us,
} from './timeline-state'
import { onPaletteChange, token, tokenAsFont } from '../core/palette'
import { waveformColumns, type WaveColumn } from './waveform'

export type Size = { width: number; height: number }

/** Poster width, as a multiple of the row height. Sixteen by nine, near enough to read a shot. */
const POSTER_RATIO = 16 / 9

const CLIP_FAMILY = 'ui-sans-serif, system-ui'
const RULER_FAMILY = 'ui-monospace, monospace'

/** `--text-tiny` and `--text-mini` at scale 1, for a paint with no document to read from. */
const CLIP_SIZE = '11px'
const RULER_SIZE = '10px'

export type PaintOptions = {
  /** What a clip is called. Absent falls back to its asset id, which is always available. */
  labelOf?: (clip: Clip) => string
  /** The waveform of a clip's source, when one has been read back. */
  peaksOf?: (clip: Clip) => Float32Array | null
  /** The still that stands for a clip, once it is decoded. */
  posterOf?: (clip: Clip) => CanvasImageSource | null
}

type Palette = {
  ruler: string
  track: string
  trackAlt: string
  border: string
  clip: string
  selected: string
  playhead: string
  text: string
  muted: string
  clipFont: string
  rulerFont: string
}

let cached: Palette | null = null

/**
 * Read once per theme, not once per paint and certainly not once per clip: `getComputedStyle`
 * forces a style resolution over the whole shell, and at sixty frames a second that alone is
 * the frame budget. The tokens only move when the theme does — see `forgetPalette`.
 */
function readPalette(): Palette {
  if (cached) return cached
  cached = computePalette()
  return cached
}

/** Called when the theme changes; the next paint reads the tokens again. */
export function forgetPalette(): void {
  cached = null
}

// Subscribed here rather than called from the hook that publishes the theme: the timeline is
// the one that knows it caches, and a module nobody imported has no cache to drop.
onPaletteChange(forgetPalette)

function computePalette(): Palette {
  // Absent under a test that never built a DOM; black is what an unreadable token falls back
  // to everywhere, rather than each caller inventing its own.
  const root = typeof document === 'undefined' ? null : document.documentElement
  const read = (name: string): string => (root ? token(root, name) : '') || '#000'

  const font = (name: string, size: string, family: string): string =>
    root ? tokenAsFont(root, name, size, family) : `${size} ${family}`

  return {
    ruler: read('--color-chassis'),
    track: read('--color-panel'),
    trackAlt: read('--color-surface'),
    border: read('--color-border'),
    clip: read('--color-elevated'),
    selected: read('--color-accent-soft'),
    playhead: read('--color-accent'),
    text: read('--color-text'),
    muted: read('--color-muted'),
    clipFont: font('--text-tiny', CLIP_SIZE, CLIP_FAMILY),
    rulerFont: font('--text-mini', RULER_SIZE, RULER_FAMILY),
  }
}

/**
 * Microseconds between two graduations, chosen so they never crowd below ~60 px apart. Below a
 * second the grid becomes the frame grid: zoomed in that far, seconds are what stops being
 * useful, and a graduation off the frame boundary cannot be trusted to cut against.
 */
export function tickStep(viewport: Viewport, state: SequenceState): Us {
  const frame = frameDuration(state.settings)
  const fits = (step: Us): boolean => step * viewport.scale >= 60

  for (const frames of [1, 2, 5, 10, 25]) {
    const step = frame * frames
    if (step < 1_000_000 && fits(step)) return step
  }

  const seconds = [1, 2, 5, 10, 30, 60, 120, 300, 600, 900]
  return (seconds.find(step => fits(step * 1_000_000)) ?? 1_800) * 1_000_000
}

function paintRuler(
  context: CanvasRenderingContext2D,
  state: SequenceState,
  viewport: Viewport,
  size: Size,
  palette: Palette,
): void {
  context.fillStyle = palette.ruler
  context.fillRect(0, 0, size.width, RULER_HEIGHT)

  const step = tickStep(viewport, state)
  const [from, to] = visibleRange(viewport, size.width)
  context.font = palette.rulerFont
  context.textBaseline = 'middle'

  for (let time = Math.floor(from / step) * step; time <= to; time += step) {
    const x = Math.round(timeToX(time, viewport)) + 0.5
    context.fillStyle = palette.border
    context.fillRect(x, RULER_HEIGHT - 6, 1, 6)

    context.fillStyle = palette.muted
    context.fillText(formatTimecode(time, state.settings), x + 4, RULER_HEIGHT / 2)
  }

  context.fillStyle = palette.border
  context.fillRect(0, RULER_HEIGHT - 1, size.width, 1)
}

function paintTrack(
  context: CanvasRenderingContext2D,
  track: Track,
  top: number,
  size: Size,
  palette: Palette,
): void {
  // A row has to be visible before it holds anything: an empty timeline that paints nothing
  // reads as a broken panel, not as an empty one.
  context.fillStyle = track.kind === 'audio' ? palette.trackAlt : palette.track
  context.fillRect(0, top, size.width, track.height)

  context.fillStyle = palette.border
  context.fillRect(0, top + track.height - 1, size.width, 1)
}

/**
 * The fade ramps, drawn as the wedge they remove from the clip. Shown rather than implied: a
 * fade nobody can see is a fade nobody remembers setting.
 */
function paintFades(
  context: CanvasRenderingContext2D,
  clip: Clip,
  viewport: Viewport,
  left: number,
  right: number,
  top: number,
  height: number,
  palette: Palette,
): void {
  const bottom = top + height
  context.fillStyle = palette.ruler

  if (clip.fadeIn > 0) {
    const to = timeToX(clip.start + clip.fadeIn, viewport)
    context.beginPath()
    context.moveTo(left, top)
    context.lineTo(to, top)
    context.lineTo(left, bottom)
    context.fill()
  }

  if (clip.fadeOut > 0) {
    const from = timeToX(clipEnd(clip) - clip.fadeOut, viewport)
    context.beginPath()
    context.moveTo(from, top)
    context.lineTo(right, top)
    context.lineTo(right, bottom)
    context.fill()
  }
}

/**
 * The waveform, filling the row under the label. Drawn as one path rather than a rectangle per
 * column: five hundred `fillRect` calls per clip is what a long montage cannot afford.
 */
function paintWaveform(
  context: CanvasRenderingContext2D,
  columns: readonly WaveColumn[],
  top: number,
  height: number,
  colour: string,
): void {
  if (columns.length === 0) return

  const middle = top + height / 2
  const reach = height / 2 - 1

  context.fillStyle = colour
  context.beginPath()
  for (const column of columns) context.lineTo(column.x, middle - column.max * reach)
  // Back along the bottom, so the outline closes into the filled body of the wave.
  for (let index = columns.length - 1; index >= 0; index--) {
    const column = columns[index]
    if (column) context.lineTo(column.x, middle - column.min * reach)
  }
  context.closePath()
  context.fill()
}

/** The poster, covering the head of a clip: enough to recognise a shot, never the whole width. */
function paintPoster(
  context: CanvasRenderingContext2D,
  poster: CanvasImageSource,
  left: number,
  right: number,
  top: number,
  height: number,
): void {
  const width = Math.min(height * POSTER_RATIO, right - left)
  if (width <= 0) return
  context.drawImage(poster, left, top, width, height)
}

function paintClip(
  context: CanvasRenderingContext2D,
  clip: Clip,
  label: string,
  viewport: Viewport,
  left: number,
  right: number,
  top: number,
  height: number,
  selected: boolean,
  palette: Palette,
  options: PaintOptions,
): void {
  const boxTop = top + CLIP_INSET
  const boxHeight = height - CLIP_INSET * 2 - 1

  context.fillStyle = selected ? palette.selected : palette.clip
  context.fillRect(left, boxTop, right - left, boxHeight)

  context.save()
  context.beginPath()
  context.rect(left, boxTop, right - left, boxHeight)
  context.clip()

  const poster = options.posterOf?.(clip) ?? null
  if (poster) paintPoster(context, poster, left, right, boxTop, boxHeight)

  const peaks = options.peaksOf?.(clip) ?? null
  if (peaks) {
    paintWaveform(
      context,
      waveformColumns(clip, peaks, viewport, left, right),
      boxTop,
      boxHeight,
      selected ? palette.text : palette.muted,
    )
  }

  paintFades(context, clip, viewport, left, right, boxTop, boxHeight, palette)

  context.fillStyle = palette.text
  context.fillText(label, left + 6, boxTop + 4)
  context.restore()

  context.fillStyle = palette.border
  context.fillRect(left, boxTop, 1, boxHeight)
  context.fillRect(right - 1, boxTop, 1, boxHeight)
}

export function paintTimeline(
  context: CanvasRenderingContext2D,
  state: SequenceState,
  viewport: Viewport,
  size: Size,
  options: PaintOptions = {},
): void {
  const [from, to]: [Us, Us] = visibleRange(viewport, size.width)
  const palette = readPalette()
  const labelOf = options.labelOf ?? (clip => clip.assetId)

  context.clearRect(0, 0, size.width, size.height)
  context.fillStyle = palette.track
  context.fillRect(0, 0, size.width, size.height)

  // Hoisted out of the clip loop: assigning `font` reparses the CSS shorthand and drops the
  // context's metrics cache, and at five hundred clips a frame that is not free.
  context.font = palette.clipFont
  context.textBaseline = 'top'

  for (const { track, offset } of trackRows(state)) {
    const top = RULER_HEIGHT + offset - viewport.scrollTop
    if (top > size.height || top + track.height < RULER_HEIGHT) continue

    paintTrack(context, track, top, size, palette)

    for (const clip of track.clips) {
      // Horizontal virtualisation: at 500 clips, painting the ones off screen is the whole cost.
      if (clipEnd(clip) < from || clip.start > to) continue

      paintClip(
        context,
        clip,
        labelOf(clip),
        viewport,
        timeToX(clip.start, viewport),
        timeToX(clipEnd(clip), viewport),
        top,
        track.height,
        state.selectedId === clip.id,
        palette,
        options,
      )
    }
  }

  paintRuler(context, state, viewport, size, palette)

  context.fillStyle = palette.playhead
  context.fillRect(Math.round(timeToX(state.playhead, viewport)), 0, 1, size.height)
}
