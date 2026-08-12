/**
 * The two shapes the canvas, the timeline and the scene band paint and hit-test with.
 *
 * Seven modules across those three engines spelt them identically, so an editor's auto-import
 * picked whichever it saw first and the result COMPILED — structural typing makes the wrong one
 * fit. `engines/core/` rather than `shared/`: neither crosses the IPC boundary.
 *
 * Not every pair of numbers in the tree, and the guard beside this file says so at length:
 * `scene/bone-picking.ts` and `texture/derive/offscreen.ts` still carry the same shapes under
 * their own names, as `shared/` carries `GraphPosition` and `Vector2` on its side of the wall.
 *
 * Deliberately unitless and space-agnostic. A canvas `Point` is in document space, a timeline
 * `Point` is a pixel on the strip; naming that here would make one of the callers wrong.
 */

export type Size = { width: number; height: number }

export type Point = { x: number; y: number }
