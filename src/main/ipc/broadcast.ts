import { BrowserWindow, type WebContents } from 'electron'

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
 * Sends back to whoever invoked — the one case where the answer belongs to ONE window and that
 * window is already named by the call. The guard is not decoration: an export reports for minutes,
 * and sending to web contents somebody closed in the meantime throws.
 */
export function sendToSender(sender: WebContents, channel: string, payload?: unknown): void {
  if (!sender.isDestroyed()) sender.send(channel, payload)
}

/** Sends to the window in front, for the native menu, whose rows belong to whatever is focused. */
export function sendToFront(channel: string, payload?: unknown): void {
  frontWindow()?.webContents.send(channel, payload)
}

/**
 * Sends to one named window, and says whether there was one.
 *
 * The answer matters to exactly one caller: an action arriving from OUTSIDE the application —
 * over MCP — has somebody waiting on it, so "there was no window" has to travel back rather than
 * be dropped in silence.
 *
 * A NAMED window rather than whichever is in front, and that is the correction: `frontWindow`
 * answers the settings window, the licences window and the mirror just as readily, and none of
 * them mounts the assistant. Sent there, the event reached a renderer that never subscribed —
 * `true` came back, so nothing was refused, and the client waited out the full two minutes for a
 * `timedOut` where an immediate `noWindow` was the truth.
 */
export function sendTo(target: BrowserWindow | null, channel: string, payload?: unknown): boolean {
  if (!target || target.isDestroyed()) return false

  target.webContents.send(channel, payload)
  return true
}
