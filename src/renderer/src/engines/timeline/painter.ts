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

type Palette = { ruler: string; clip: string; selected: string; playhead: string }

/**
 * Read once per paint, not once per clip: `getComputedStyle` forces a style resolution, and at
 * five hundred clips sixty times a second that is the whole frame budget.
 */
function readPalette(): Palette {
  const style = typeof document === 'undefined' ? null : getComputedStyle(document.documentElement)
  const token = (name: string): string => style?.getPropertyValue(name).trim() || '#000'

  return {
    ruler: token('--color-surface'),
    clip: token('--color-elevated'),
    selected: token('--color-accent-soft'),
    playhead: token('--color-accent'),
  }
}

export function paintTimeline(
  context: CanvasRenderingContext2D,
  state: SequenceState,
  viewport: Viewport,
  size: Size,
): void {
  const [from, to] = visibleRange(viewport, size.width)
  const palette = readPalette()

  context.clearRect(0, 0, size.width, size.height)

  context.fillStyle = palette.ruler
  context.fillRect(0, 0, size.width, RULER_HEIGHT)

  state.tracks.forEach((track, row) => {
    const top = trackTop(row, viewport)
    if (top > size.height || top + TRACK_HEIGHT < RULER_HEIGHT) return

    for (const clip of track.clips) {
      // Horizontal virtualisation: at 500 clips, painting the ones off screen is the whole cost.
      if (clipEnd(clip) < from || clip.start > to) continue

      const left = timeToX(clip.start, viewport)
      context.fillStyle = state.selectedId === clip.id ? palette.selected : palette.clip
      context.fillRect(left, top, timeToX(clipEnd(clip), viewport) - left, TRACK_HEIGHT)
    }
  })

  context.fillStyle = palette.playhead
  context.fillRect(timeToX(state.playhead, viewport), 0, 1, size.height)
}
