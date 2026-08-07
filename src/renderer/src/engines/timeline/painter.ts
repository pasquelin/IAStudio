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

export type Size = { width: number; height: number }

export type PaintOptions = {
  /** What a clip is called. Absent falls back to its asset id, which is always available. */
  labelOf?: (clip: Clip) => string
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
}

/**
 * Read once per paint, not once per clip: `getComputedStyle` forces a style resolution, and at
 * five hundred clips sixty times a second that is the whole frame budget.
 */
function readPalette(): Palette {
  const style = typeof document === 'undefined' ? null : getComputedStyle(document.documentElement)
  const token = (name: string): string => style?.getPropertyValue(name).trim() || '#000'

  return {
    ruler: token('--color-chassis'),
    track: token('--color-base'),
    trackAlt: token('--color-surface'),
    border: token('--color-border'),
    clip: token('--color-elevated'),
    selected: token('--color-accent-soft'),
    playhead: token('--color-accent'),
    text: token('--color-text'),
    muted: token('--color-muted'),
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
  context.font = '10px ui-monospace, monospace'
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
): void {
  const boxTop = top + CLIP_INSET
  const boxHeight = height - CLIP_INSET * 2 - 1

  context.fillStyle = selected ? palette.selected : palette.clip
  context.fillRect(left, boxTop, right - left, boxHeight)

  context.save()
  context.beginPath()
  context.rect(left, boxTop, right - left, boxHeight)
  context.clip()

  paintFades(context, clip, viewport, left, right, boxTop, boxHeight, palette)

  context.font = '11px ui-sans-serif, system-ui'
  context.textBaseline = 'top'
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
      )
    }
  }

  paintRuler(context, state, viewport, size, palette)

  context.fillStyle = palette.playhead
  context.fillRect(Math.round(timeToX(state.playhead, viewport)), 0, 1, size.height)
}
