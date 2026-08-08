import { clamp } from '@/helpers/numeric'
import type { Rect } from './canvas-state'
import type { Point } from './shape-geometry'

/**
 * Where the document sits on screen. `x` and `y` are the screen position of the document's
 * top-left corner in CSS pixels; `scale` is how many screen pixels one document pixel takes.
 *
 * Session state, not document state: it is never serialized with the canvas, and ⌘Z does not
 * give a zoom back.
 */
export type Viewport = { x: number; y: number; scale: number }

export type Size = { width: number; height: number }

/** Below 2% a 4096² document is a smear; above 64 a pixel fills a quarter of the screen. */
export const MIN_SCALE = 0.02
export const MAX_SCALE = 64

/** Breathing room around a fitted document, so its edge never touches the panel's. */
const FIT_PADDING = 24

const IDENTITY_VIEWPORT: Viewport = { x: 0, y: 0, scale: 1 }

/**
 * Everything about how a document is looked at rather than what it holds. Kept out of
 * `CanvasState` deliberately: none of it belongs in a saved file, and none of it belongs in the
 * undo stack — ⌘Z after a pan has to give a brush stroke back, not a scroll position.
 */
export type CanvasView = {
  viewport: Viewport
  rulers: boolean
  guides: boolean
  snap: boolean
}

export const DEFAULT_VIEW: CanvasView = {
  viewport: IDENTITY_VIEWPORT,
  rulers: true,
  guides: true,
  snap: true,
}

export function sameViewport(a: Viewport, b: Viewport): boolean {
  return a.x === b.x && a.y === b.y && a.scale === b.scale
}

export function clampScale(scale: number): number {
  if (!Number.isFinite(scale)) return 1
  return clamp(scale, MIN_SCALE, MAX_SCALE)
}

/**
 * Half-pixel offset, or a one-pixel line spreads over two and comes out grey. Here rather than
 * with the painters: the overlay, the crop chrome and the grips all snap to the same grid, and
 * the convention belongs beside the screen-space maths it applies to.
 */
export function crisp(value: number): number {
  return Math.round(value) + 0.5
}

export function toScreen(viewport: Viewport, point: Point): Point {
  return { x: point.x * viewport.scale + viewport.x, y: point.y * viewport.scale + viewport.y }
}

export function toDocument(viewport: Viewport, point: Point): Point {
  return { x: (point.x - viewport.x) / viewport.scale, y: (point.y - viewport.y) / viewport.scale }
}

/**
 * Zooms while keeping whatever sits under `anchor` exactly where it is. Anything else makes the
 * wheel feel like it is dragging the image away from the pointer.
 */
export function zoomAt(viewport: Viewport, scale: number, anchor: Point): Viewport {
  const next = clampScale(scale)
  const point = toDocument(viewport, anchor)
  return { scale: next, x: anchor.x - point.x * next, y: anchor.y - point.y * next }
}

/**
 * The whole document visible and centred. Never magnifies past 1: fitting is not upscaling.
 *
 * `inset` is what the chrome eats off the top and left — the ruler bands. Without it a document
 * barely smaller than the panel is centred with its first rows under an opaque band, where they
 * cannot be seen and cannot be painted.
 */
export function fitTo(document: Size, host: Size, inset: number = 0): Viewport {
  const width = Math.max(1, host.width - inset - FIT_PADDING * 2)
  const height = Math.max(1, host.height - inset - FIT_PADDING * 2)
  const scale = clampScale(
    Math.min(
      1,
      Math.min(width / Math.max(1, document.width), height / Math.max(1, document.height)),
    ),
  )
  return centerOn(document, host, scale, inset)
}

/**
 * A picture laid inside a box, centred, shrunk to fit but never magnified — the same rule as
 * `fitTo`, in document units rather than screen ones. Magnifying an imported picture to fill the
 * canvas would blur it on arrival, with no way back to its own pixels.
 */
export function containIn(source: Size, box: Size): Rect {
  const scale = Math.min(
    1,
    box.width / Math.max(1, source.width),
    box.height / Math.max(1, source.height),
  )
  const width = source.width * scale
  const height = source.height * scale

  return {
    x: Math.round((box.width - width) / 2),
    y: Math.round((box.height - height) / 2),
    width,
    height,
  }
}

/** Same framing as `fitTo`, at a scale the caller chose — ⌘1 lands here. */
export function centerOn(document: Size, host: Size, scale: number, inset: number = 0): Viewport {
  const next = clampScale(scale)
  return {
    scale: next,
    x: inset + Math.round((host.width - inset - document.width * next) / 2),
    y: inset + Math.round((host.height - inset - document.height * next) / 2),
  }
}

/**
 * The stops ⌘+ and ⌘− walk through. Photoshop's own ladder: doubling every step above 100% and
 * halving below it, with the odd stop in between where the eye needs one.
 */
const ZOOM_STOPS: readonly number[] = [
  0.02, 0.03, 0.05, 0.0625, 0.0833, 0.125, 0.1667, 0.25, 0.3333, 0.5, 0.6667, 1, 1.5, 2, 3, 4, 5, 6,
  8, 12, 16, 24, 32, 48, 64,
]

/** A hair of tolerance, or a scale of 0.9999999 walks up to the stop it already sits on. */
const EPSILON = 1e-6

export function nextZoom(scale: number): number {
  return ZOOM_STOPS.find(stop => stop > scale + EPSILON) ?? MAX_SCALE
}

export function previousZoom(scale: number): number {
  return ZOOM_STOPS.findLast(stop => stop < scale - EPSILON) ?? MIN_SCALE
}

/**
 * The rectangle of the document that is currently on screen, in document coordinates. Rulers and
 * grids draw from it rather than walking the whole document: at 2% a 4096² canvas would emit
 * thousands of ticks nobody can see.
 */
export function visibleRect(viewport: Viewport, host: Size): Rect {
  const start = toDocument(viewport, { x: 0, y: 0 })
  const end = toDocument(viewport, { x: host.width, y: host.height })
  return { x: start.x, y: start.y, width: end.x - start.x, height: end.y - start.y }
}
