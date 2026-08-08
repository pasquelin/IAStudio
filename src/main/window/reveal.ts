/**
 * As much of a `BrowserWindow` as bringing one forward needs. Narrow on purpose: the decision
 * is then testable without an Electron window, which the main process cannot build in a test.
 */
export type RevealableWindow = {
  isDestroyed: () => boolean
  isMinimized: () => boolean
  restore: () => void
  focus: () => void
}

/**
 * Brings a window back to the user. `focus()` alone is a no-op on a minimised window, on macOS
 * and on Windows both — restoring first is what makes the call do anything at all.
 *
 * Takes `null` so callers can hand over whatever they hold without a guard of their own.
 */
export function revealWindow(window: RevealableWindow | null): void {
  if (!window || window.isDestroyed()) return
  if (window.isMinimized()) window.restore()
  window.focus()
}
