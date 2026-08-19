/**
 * What an export in flight says, on both sides of the boundary.
 *
 * Invariant 6 asks two things of every long task, not one: it reports how far along it is, and it
 * can be stopped. Only the video render answered either, and it had nowhere to say so.
 */

/**
 * Handed to whatever does the writing, wherever its loop lives — a face at a time in the window,
 * a chunk at a time in the bundle's own process. Both optional: a caller with nobody watching
 * would otherwise have to invent one.
 */
export type ExportWatch = {
  /** Called as each unit lands. `total` is whatever the loop counts — faces, pictures, bytes. */
  onStep?: (done: number, total: number) => void
  signal?: AbortSignal
}

/**
 * What the main process pushes back while it writes. Only the needle: the window minted the row
 * and already holds its name, and echoing it would let the two disagree.
 */
export type ExportWriteProgress = { id: string; ratio: number }

/**
 * A share of the work, with nothing to divide by answered as nothing done — a bundle whose media
 * are all empty files, or a target that resolved to no picture. `0/0` is `NaN`, which a progress
 * bar draws as an empty track and a percentage prints as `NaN %`.
 */
export function exportRatio(done: number, total: number): number {
  return total > 0 ? done / total : 0
}
