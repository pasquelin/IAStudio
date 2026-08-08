import type { BrowserWindow } from 'electron'

/** Only what bringing a window forward needs, so the decision is testable without one. */
export type RevealableWindow = Pick<
  BrowserWindow,
  'isDestroyed' | 'isMinimized' | 'isVisible' | 'restore' | 'show' | 'focus'
>

export function revealWindow(window: RevealableWindow): void {
  if (window.isDestroyed()) return

  // `Focus()` returns early on a window it considers invisible — which on macOS and Windows
  // covers both a window never shown and a minimised one. The main window spends the whole
  // splash in the first state, so a second launch landing there would otherwise do nothing.
  // X11 reports a minimised window as visible, hence the second call rather than either alone.
  if (!window.isVisible()) window.show()
  if (window.isMinimized()) window.restore()

  window.focus()
}
