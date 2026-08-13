/**
 * What every 2D surface has to do before it paints, written once.
 *
 * `AnimationCanvas` and `TimelineCanvas` spelt these eighteen lines identically — jscpd caught
 * them as one clone of the tree's largest kind. `CanvasOverlay.resize` is deliberately NOT a
 * caller: it is handed the size rather than reading it off the element, and it sets the CSS size
 * too, so folding it in here would mean two shapes under one name.
 *
 * Not a React hook and no import of React, so an engine may call it (CLAUDE.md, invariant 4).
 */
import type { Size } from './geometry'

/**
 * Matches the backing store to the display and hands back the size to paint in, in CSS pixels.
 *
 * Two things are load-bearing. The backing store is in DEVICE pixels while drawing stays in CSS
 * pixels — without that a ruler is soft on every retina display. And it is assigned ONLY when it
 * actually changed: assigning `width` at all throws the GPU texture away and reallocates several
 * megabytes, even for the same value, and a `ResizeObserver` fires on every layout pass.
 *
 * The transform is set outside that guard: it is lost with the backing store, and a display
 * change — a window dragged to another screen — moves the ratio while the pixel size stands.
 */
export function fitToDisplay(canvas: HTMLCanvasElement, context: CanvasRenderingContext2D): Size {
  const ratio = window.devicePixelRatio
  const width = canvas.clientWidth
  const height = canvas.clientHeight

  const backing = { width: Math.round(width * ratio), height: Math.round(height * ratio) }
  if (canvas.width !== backing.width || canvas.height !== backing.height) {
    canvas.width = backing.width
    canvas.height = backing.height
  }
  context.setTransform(ratio, 0, 0, ratio, 0, 0)

  return { width, height }
}
