import {
  RULER_HEIGHT,
  TRACK_HEIGHT,
  timeToX,
  trackTop,
  visibleRange,
  type Viewport,
} from './timeline-geometry'
import { clipEnd, type SequenceState } from './timeline-state'

export type Size = { width: number; height: number }

/** Reads the palette from CSS variables: a hex here would drift from `design/tokens`. */
function token(name: string): string {
  if (typeof document === 'undefined') return '#000'
  return getComputedStyle(document.documentElement).getPropertyValue(name).trim() || '#000'
}

export function paintTimeline(
  context: CanvasRenderingContext2D,
  state: SequenceState,
  viewport: Viewport,
  size: Size,
): void {
  const [from, to] = visibleRange(viewport, size.width)

  context.clearRect(0, 0, size.width, size.height)

  context.fillStyle = token('--color-surface')
  context.fillRect(0, 0, size.width, RULER_HEIGHT)

  state.tracks.forEach((track, row) => {
    const top = trackTop(row, viewport)
    if (top > size.height || top + TRACK_HEIGHT < RULER_HEIGHT) return

    for (const clip of track.clips) {
      // Horizontal virtualisation: at 500 clips, painting the ones off screen is the whole cost.
      if (clipEnd(clip) < from || clip.start > to) continue

      const left = timeToX(clip.start, viewport)
      context.fillStyle = token(
        state.selectedId === clip.id ? '--color-accent-soft' : '--color-elevated',
      )
      context.fillRect(left, top, timeToX(clipEnd(clip), viewport) - left, TRACK_HEIGHT)
    }
  })

  context.fillStyle = token('--color-accent')
  context.fillRect(timeToX(state.playhead, viewport), 0, 1, size.height)
}
