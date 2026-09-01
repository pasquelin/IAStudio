// SPDX-License-Identifier: MIT

/** Where the pointer is, in the client pixels the event reported, and whether it is held down. */
export type Pointer = { x: number; y: number; down: boolean }

/**
 * Everything one step needs to know, in ONE value.
 *
 * Grouped deliberately. Measured on 2026-08-26: a call across the script bridge costs 1,34 µs
 * against 0,150 ms for a thousand of the same operations done inside the machine — the bridge is
 * worth nine times the calculation. A port answering one key at a time would pay it per key.
 */
export type InputState = {
  /** Key codes held, spelt as `KeyboardEvent.code` does — `KeyW`, `Space`. */
  held: readonly string[]
  /** What went down, and what came up, since the previous step closed. */
  pressed: readonly string[]
  released: readonly string[]
  pointer: Pointer
}

export type InputPort = {
  state: () => InputState
  /**
   * Closes the step: `pressed` and `released` answer for what happened since the last call. The
   * runtime calls it, never a script.
   */
  endStep: () => void
  /** Lets go of whatever the host attached this to. */
  detach: () => void
}
