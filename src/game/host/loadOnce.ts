// SPDX-License-Identifier: MIT

/**
 * 🛑 One WebAssembly engine for the life of the window, held as the PROMISE so two games starting
 * at once wait on one load. Cleared only when the LOAD itself failed: an engine that built badly
 * must keep its memo, or the next Play instantiates a second memory and orphans every world
 * already running in this window.
 */
export function loadOnce<T>(start: () => Promise<T>): () => Promise<T> {
  let held: Promise<T> | null = null

  return async () => {
    held ??= start()
    try {
      return await held
    } catch (trouble) {
      held = null
      throw trouble
    }
  }
}
