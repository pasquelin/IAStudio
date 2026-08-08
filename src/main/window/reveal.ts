import type { BrowserWindow } from 'electron'

/** Only what bringing a window forward needs, so the decision is testable without one. */
export type RevealableWindow = Pick<
  BrowserWindow,
  'isDestroyed' | 'isMinimized' | 'isVisible' | 'restore' | 'show' | 'focus'
>

export function revealWindow(window: RevealableWindow): void {
  if (window.isDestroyed()) return

  // Both are no-ops of their own: Electron's `Focus()` returns early on a window that is not
  // visible, and on one that is minimised. The main window spends the whole splash in the
  // first state — created, alive, never shown — so a second launch there would do nothing.
  if (!window.isVisible()) window.show()
  if (window.isMinimized()) window.restore()

  window.focus()
}
