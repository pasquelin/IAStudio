import {
  RULER_HEIGHT,
  TRACK_HEIGHT,
  timeToX,
  trackTop,
  visibleRange,
  type Viewport,
} from './timeline-geometry'
import { formatTimecode } from './timecode'
import { clipEnd, type SequenceState, type Track, type Us } from './timeline-state'

export type Size = { width: number; height: number }

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

/** Seconds between two graduations, chosen so they never crowd below ~60 px apart. */
function tickStep(viewport: Viewport): number {
  const candidates = [1, 2, 5, 10, 30, 60, 120, 300, 600]
  return candidates.find(step => step * 1_000_000 * viewport.scale >= 60) ?? 900
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

  const step = tickStep(viewport) * 1_000_000
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
  context.fillRect(0, top, size.width, TRACK_HEIGHT)

  context.fillStyle = palette.border
  context.fillRect(0, top + TRACK_HEIGHT - 1, size.width, 1)

  context.font = '10px ui-sans-serif, system-ui'
  context.textBaseline = 'middle'
  context.fillStyle = palette.muted
  context.fillText(track.id, 6, top + 10)
}

function paintClip(
  context: CanvasRenderingContext2D,
  label: string,
  left: number,
  right: number,
  top: number,
  selected: boolean,
  palette: Palette,
): void {
  context.fillStyle = selected ? palette.selected : palette.clip
  context.fillRect(left, top + 2, right - left, TRACK_HEIGHT - 5)

  context.fillStyle = palette.border
  context.fillRect(left, top + 2, 1, TRACK_HEIGHT - 5)
  context.fillRect(right - 1, top + 2, 1, TRACK_HEIGHT - 5)

  context.save()
  context.beginPath()
  context.rect(left, top + 2, right - left, TRACK_HEIGHT - 5)
  context.clip()
  context.font = '11px ui-sans-serif, system-ui'
  context.textBaseline = 'middle'
  context.fillStyle = palette.text
  context.fillText(label, left + 6, top + TRACK_HEIGHT / 2)
  context.restore()
}

export function paintTimeline(
  context: CanvasRenderingContext2D,
  state: SequenceState,
  viewport: Viewport,
  size: Size,
): void {
  const [from, to]: [Us, Us] = visibleRange(viewport, size.width)
  const palette = readPalette()

  context.clearRect(0, 0, size.width, size.height)
  context.fillStyle = palette.track
  context.fillRect(0, 0, size.width, size.height)

  state.tracks.forEach((track, row) => {
    const top = trackTop(row, viewport)
    if (top > size.height || top + TRACK_HEIGHT < RULER_HEIGHT) return

    paintTrack(context, track, top, size, palette)

    for (const clip of track.clips) {
      // Horizontal virtualisation: at 500 clips, painting the ones off screen is the whole cost.
      if (clipEnd(clip) < from || clip.start > to) continue

      paintClip(
        context,
        clip.assetId,
        timeToX(clip.start, viewport),
        timeToX(clipEnd(clip), viewport),
        top,
        state.selectedId === clip.id,
        palette,
      )
    }
  })

  paintRuler(context, state, viewport, size, palette)

  context.fillStyle = palette.playhead
  context.fillRect(Math.round(timeToX(state.playhead, viewport)), 0, 1, size.height)
}
