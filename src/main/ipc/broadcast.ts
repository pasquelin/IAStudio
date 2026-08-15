import { BrowserWindow } from 'electron'

/**
 * Pushes an event to every live renderer. Used for state the main process owns and all
 * windows replicate — the open project, job progress. Commands coming from the native menu
 * do the opposite and target the focused window only — see `sendToFront`.
 */
export function broadcast(channel: string, payload?: unknown): void {
  for (const window of BrowserWindow.getAllWindows()) {
    if (!window.isDestroyed()) window.webContents.send(channel, payload)
  }
}

/**
 * The window a command belongs to.
 *
 * Broadcasting one would run ⌘N in every window at once — the very "two windows holding the
 * same document" trap listed in CLAUDE.md.
 *
 * On macOS the app outlives its last window, so the menu stays usable with nothing focused; we
 * fall back to the first live window rather than dropping the command in silence. The splash is
 * skipped by `isFocusable`: it has no bridge, so anything sent there is lost.
 */
export function frontWindow(): BrowserWindow | null {
  const focusable = BrowserWindow.getAllWindows().filter(window => window.isFocusable())
  const target = BrowserWindow.getFocusedWindow() ?? focusable[0]
  return target && !target.isDestroyed() ? target : null
}

/**
 * Sends to that window alone, and says whether there was one.
 *
 * The answer matters to exactly one caller: an action arriving from OUTSIDE the application —
 * over MCP — has somebody waiting on it, so "no window was in front" has to travel back rather
 * than be dropped in silence. The menu ignores it, as it should: a row clicked in a menu that
 * only exists because a window does cannot miss.
 */
export function sendToFront(channel: string, payload?: unknown): boolean {
  const target = frontWindow()
  target?.webContents.send(channel, payload)
  return target !== null
}
