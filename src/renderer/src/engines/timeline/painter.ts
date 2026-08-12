import {
  CLIP_INSET,
  EDGE_BAR_INSET,
  EDGE_BAR_WIDTH,
  edgeGrab,
  FADE_BAND,
  RULER_HEIGHT,
  timeToX,
  trackRows,
  visibleRange,
  type Viewport,
} from './timeline-geometry'
import { paintRuler as paintBandRuler } from './ruler'
import { clipEnd, type Clip, type SequenceState, type Track, type Us } from './timeline-state'
import { memoPalette, rootColour, rootFont } from '../core/palette'
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

const readPalette = memoPalette((): Palette => ({
  ruler: rootColour('--color-chassis'),
  track: rootColour('--color-panel'),
  trackAlt: rootColour('--color-surface'),
  border: rootColour('--color-border'),
  clip: rootColour('--color-elevated'),
  selected: rootColour('--color-accent-soft'),
  playhead: rootColour('--color-accent'),
  text: rootColour('--color-text'),
  muted: rootColour('--color-muted'),
  clipFont: rootFont('--text-tiny', CLIP_SIZE, CLIP_FAMILY),
  rulerFont: rootFont('--text-mini', RULER_SIZE, RULER_FAMILY),
}))

function paintRuler(
  context: CanvasRenderingContext2D,
  state: SequenceState,
  viewport: Viewport,
  size: Size,
  palette: Palette,
): void {
  paintBandRuler(context, {
    viewport,
    width: size.width,
    fps: state.settings.fps,
    style: {
      background: palette.ruler,
      tick: palette.border,
      text: palette.muted,
      font: palette.rulerFont,
    },
  })
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

/**
 * The grips at both ends, which is what says a clip can be lengthened at all.
 *
 * They start BELOW the fade band, and that offset is the whole point: up there the same corner
 * opens a fade rather than a trim (`hitTest`), so a bar drawn into the band would be pressed for
 * a lengthening and hand back a ramp. Skipped altogether once the bar would be wider than the
 * zone that grabs it — on a narrow clip `edgeGrab` gives the middle back to the drag, and a bar
 * sticking out past its own target promises a trim that is refused.
 */
function paintEdgeBars(
  context: CanvasRenderingContext2D,
  left: number,
  right: number,
  top: number,
  height: number,
  selected: boolean,
  palette: Palette,
): void {
  if (edgeGrab(right - left) < EDGE_BAR_WIDTH) return

  // The band is measured from the row, `top` is the clip box: one inset apart.
  const barTop = top + FADE_BAND - CLIP_INSET
  // Never negative: MIN_TRACK_HEIGHT leaves a 23 px box against the 13 px the two insets take.
  const barHeight = height - (FADE_BAND - CLIP_INSET) - EDGE_BAR_INSET

  context.fillStyle = selected ? palette.text : palette.muted
  context.fillRect(left, barTop, EDGE_BAR_WIDTH, barHeight)
  context.fillRect(right - EDGE_BAR_WIDTH, barTop, EDGE_BAR_WIDTH, barHeight)
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

  // After the border and outside the clipping path: a grip drawn under the poster is a grip
  // nobody sees, and the border alone reads as a seam between two clips rather than an end.
  paintEdgeBars(context, left, right, boxTop, boxHeight, selected, palette)
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
