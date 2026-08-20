/**
 * A still of the 3D view, as the menu asks for one.
 *
 * Shared because the question crosses the boundary: the native menu names a quality, the window
 * renders it. What comes back is an ordinary picture of the project — something to post, and
 * what the template thumbnails are drawn with.
 */
export type CaptureQuality = 'view' | 'fullHd' | 'quadHd' | 'ultraHd'

export const CAPTURE_QUALITIES: readonly CaptureQuality[] = ['view', 'fullHd', 'quadHd', 'ultraHd']

/** What ⌘-less menu row and command take: the view's own pixels, and no question asked. */
export const DEFAULT_CAPTURE_QUALITY: CaptureQuality = 'view'

/**
 * The height each quality renders at, in pixels. `view` has none — it takes the panel's own,
 * whatever that is on the day.
 */
const HEIGHTS: Record<Exclude<CaptureQuality, 'view'>, number> = {
  fullHd: 1080,
  quadHd: 1440,
  ultraHd: 2160,
}

export type CaptureSize = { width: number; height: number }

/**
 * How big the picture comes out: the view's shape, at the height the quality asks for.
 *
 * The FRAMING never changes — only the pixel count does. A capture that squared the picture off
 * would show more or less of the scene than the panel does, and the still would no longer be
 * what was on screen.
 *
 * A view of no height at all — a panel not laid out yet — falls back to the quality's own, so a
 * capture asked for too early gives a picture rather than nothing.
 */
export function captureSize(view: CaptureSize, quality: CaptureQuality): CaptureSize {
  // A view of no height falls back to 1080p AND to 16:9 — both halves, which is what makes the
  // fallback worth anything: taking the height alone from a panel that has none writes a picture
  // one pixel tall, and `view` is the quality the keyboard command takes.
  const measured = view.height > 0
  const height =
    quality === 'view' ? (measured ? Math.round(view.height) : HEIGHTS.fullHd) : HEIGHTS[quality]
  const aspect = measured ? view.width / view.height : 16 / 9

  return {
    width: Math.max(1, Math.round(height * aspect)),
    height: Math.max(1, height),
  }
}
