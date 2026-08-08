import type { BrowserWindow } from 'electron'

/** Only what bringing a window forward needs, so the decision is testable without one. */
export type RevealableWindow = Pick<
  BrowserWindow,
  'isDestroyed' | 'isMinimized' | 'restore' | 'focus'
>

export function revealWindow(window: RevealableWindow): void {
  if (window.isDestroyed()) return
  // `focus()` alone is a no-op on a minimised window, on macOS and on Windows both.
  if (window.isMinimized()) window.restore()
  window.focus()
}
