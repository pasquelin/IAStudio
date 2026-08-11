/**
 * How a viewport's surface is divided, and where each division lands.
 *
 * Pure geometry, deliberately: four views on one canvas is `setViewport`/`setScissor` arithmetic
 * before it is anything else, and arithmetic that only runs behind a GPU is arithmetic nothing
 * measures — jsdom has no WebGL context.
 */

/** In CSS pixels, origin top-left — the frame the DOM and the pointer both speak. */
export type PaneRect = { x: number; y: number; width: number; height: number }

/** One view filling the surface, or the four of a modelling package: top, front, left, free. */
export type PaneLayout = 'single' | 'quad'

export const PANE_LAYOUTS: readonly PaneLayout[] = ['single', 'quad']

export function isPaneLayout(value: string): value is PaneLayout {
  return PANE_LAYOUTS.some(layout => layout === value)
}

/** How many views a layout draws. The one number both the engine and its callers size arrays by. */
export function paneCount(layout: PaneLayout): number {
  return layout === 'quad' ? 4 : 1
}

/**
 * Where each view sits, reading left to right then top to bottom.
 *
 * The right column takes what the left one rounded away, and the bottom row likewise: halves of
 * an odd width floored twice leave a column of pixels drawn by nobody, and an undrawn column on a
 * dark canvas reads as a seam the design never asked for.
 */
export function paneRects(layout: PaneLayout, width: number, height: number): PaneRect[] {
  const full = { x: 0, y: 0, width, height }
  if (layout === 'single') return [full]

  const left = Math.floor(width / 2)
  const top = Math.floor(height / 2)
  const right = width - left
  const bottom = height - top

  return [
    { x: 0, y: 0, width: left, height: top },
    { x: left, y: 0, width: right, height: top },
    { x: 0, y: top, width: left, height: bottom },
    { x: left, y: top, width: right, height: bottom },
  ]
}

/**
 * Which view a point falls in, or `null` when it falls outside the surface entirely.
 *
 * Edges belong to the pane they open: a point exactly on the divider is in the right or lower
 * one, so no coordinate is claimed twice and none is claimed by nobody.
 */
export function paneAt(rects: readonly PaneRect[], x: number, y: number): number | null {
  const found = rects.findIndex(
    rect => x >= rect.x && x < rect.x + rect.width && y >= rect.y && y < rect.y + rect.height,
  )
  return found === -1 ? null : found
}

/**
 * The same rectangle as WebGL wants it: origin bottom-left, and in device pixels.
 *
 * Two conversions in one, because they are never needed apart — `setViewport` takes device
 * pixels while the pointer speaks CSS ones, and a pane placed with one and picked with the other
 * is a pane whose clicks land in its neighbour.
 */
export function glRect(rect: PaneRect, surfaceHeight: number, pixelRatio: number): PaneRect {
  return {
    x: rect.x * pixelRatio,
    y: (surfaceHeight - rect.y - rect.height) * pixelRatio,
    width: rect.width * pixelRatio,
    height: rect.height * pixelRatio,
  }
}
