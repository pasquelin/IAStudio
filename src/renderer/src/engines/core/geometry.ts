/**
 * The two shapes every painter and every hit test needs, declared once.
 *
 * Seven modules across three engines spelt these identically, so an editor's auto-import picked
 * whichever it saw first and the result COMPILED — structural typing makes the wrong one fit.
 * `engines/core/` rather than `shared/`: neither crosses the IPC boundary.
 *
 * Deliberately unitless and space-agnostic. A canvas `Point` is in document space, a timeline
 * `Point` is a pixel on the strip; naming that here would make one of the callers wrong.
 */

export type Size = { width: number; height: number }

export type Point = { x: number; y: number }
