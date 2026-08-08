import { clamp } from '@/helpers/numeric'
import type { Rect } from './canvas-state'
import { ANCHOR, cornersOfRect, gripRects, HANDLE_IDS, type HandleId } from './handles'
import { box, type Point } from './shape-geometry'
import { crisp, toScreen, type Size, type Viewport } from './viewport'

/**
 * `null` when the drag carved nothing out: a click would otherwise crop the document down to the
 * single pixel `resizeCanvas` floors at, which is a document nothing can be recovered from.
 */
export function cropRect(
  from: Point,
  to: Point,
  documentSize: Size,
  constrain: boolean,
): Rect | null {
  const dragged = box(from, to, constrain)
  const x = Math.round(clamp(dragged.x, 0, documentSize.width))
  const y = Math.round(clamp(dragged.y, 0, documentSize.height))
  const width = Math.round(clamp(dragged.x + dragged.width, 0, documentSize.width)) - x
  const height = Math.round(clamp(dragged.y + dragged.height, 0, documentSize.height)) - y

  return width >= 1 && height >= 1 ? { x, y, width, height } : null
}

/**
 * The frame after one of its grips was dragged to `to`. The edges the grip does not pull stay
 * where they are, so the opposite corner is fixed — the same rule the layer grips follow.
 *
 * Routed back through `cropRect`, which is what keeps a dragged frame and an adjusted one under
 * one set of rules: clamped to the document, whole-pixel, and `null` rather than collapsed. A
 * grip pulled past the far edge flips the frame instead of inverting it, since `box` normalises.
 */
export function resizeCrop(
  rect: Rect,
  handle: HandleId,
  to: Point,
  documentSize: Size,
  constrain: boolean,
): Rect | null {
  // Read off `ANCHOR`, which already says which corner each grip pulls against: an anchor at 1
  // means the far edge is the right or the bottom, so the grip moves the left or the top. Keyed
  // on the union rather than tested on the letters, so renaming a grip is a compile error.
  const anchor = ANCHOR[handle]
  const left = anchor.x === 1 ? to.x : rect.x
  const right = anchor.x === 0 ? to.x : rect.x + rect.width
  const top = anchor.y === 1 ? to.y : rect.y
  const bottom = anchor.y === 0 ? to.y : rect.y + rect.height

  return cropRect({ x: left, y: top }, { x: right, y: bottom }, documentSize, constrain)
}

/** Everything the crop chrome puts on screen, in screen pixels and ready to fill or stroke. */
export type CropChrome = {
  /** The bands of the document the drop would cut away. Empty when the frame keeps all of it. */
  scrim: readonly Rect[]
  frame: Rect
  grips: readonly Rect[]
}

/**
 * Where the crop frame, its grips and the dimming go, in screen space. Pure, so what the overlay
 * decides can be read back without a 2D context — jsdom has none, and the chrome would otherwise
 * be the one part of the gesture nothing checks.
 *
 * Only the document is dimmed: outside it there is nothing to lose.
 */
export function cropChrome(rect: Rect, viewport: Viewport, documentSize: Size): CropChrome {
  const inside = toScreen(viewport, { x: rect.x, y: rect.y })
  const far = toScreen(viewport, { x: rect.x + rect.width, y: rect.y + rect.height })
  const origin = toScreen(viewport, { x: 0, y: 0 })
  const corner = toScreen(viewport, { x: documentSize.width, y: documentSize.height })
  const grips = gripRects(cornersOfRect(rect), viewport)

  const bands = [
    { x: origin.x, y: origin.y, width: corner.x - origin.x, height: inside.y - origin.y },
    { x: origin.x, y: far.y, width: corner.x - origin.x, height: corner.y - far.y },
    { x: origin.x, y: inside.y, width: inside.x - origin.x, height: far.y - inside.y },
    { x: far.x, y: inside.y, width: corner.x - far.x, height: far.y - inside.y },
  ]

  return {
    // A band of no area is a fill of nothing: dropped here rather than drawn and wasted.
    scrim: bands.filter(band => band.width > 0 && band.height > 0),
    frame: {
      x: crisp(inside.x),
      y: crisp(inside.y),
      width: Math.round(far.x - inside.x),
      height: Math.round(far.y - inside.y),
    },
    grips: HANDLE_IDS.map(id => grips[id]),
  }
}
