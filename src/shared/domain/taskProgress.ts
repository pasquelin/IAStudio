/**
 * What a long task in flight says, on both sides of the boundary.
 *
 * Invariant 6 asks two things of every one of them, not one: it reports how far along it is, and
 * it can be stopped. Only the video render answered either, and it had nowhere to say so.
 *
 * A TASK, not an export: the same table carries the video render, the three writes, and reading a
 * bundle back in — a name saying « export » would lie about two of the five.
 */

/**
 * Handed to whatever does the work, wherever its loop lives — a face at a time in the window, a
 * chunk at a time in the bundle's own process. Both optional: a caller with nobody watching would
 * otherwise have to invent one.
 */
export type TaskWatch = {
  /** Called as each unit lands. `total` is whatever the loop counts — faces, pictures, bytes. */
  onStep?: (done: number, total: number) => void
  signal?: AbortSignal
}

/**
 * What the main process pushes back while it works. Only the needle: the window minted the row
 * and already holds its name, and echoing it would let the two disagree.
 */
export type TaskProgress = { id: string; ratio: number }

/**
 * A share of the work, with nothing to divide by answered as nothing done — a bundle whose media
 * are all empty files, or a target that resolved to no picture. `0/0` is `NaN`, which a progress
 * bar draws as an empty track and a percentage prints as `NaN %`.
 */
export function taskRatio(done: number, total: number): number {
  return total > 0 ? done / total : 0
}
