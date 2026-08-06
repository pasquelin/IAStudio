import { BrowserWindow } from 'electron'

/**
 * Pushes an event to every live renderer. Used for state the main process owns and all
 * windows replicate — the open project, job progress. Commands coming from the native menu
 * do the opposite and target the focused window only.
 */
export function broadcast(channel: string, payload?: unknown): void {
  for (const window of BrowserWindow.getAllWindows()) {
    if (!window.isDestroyed()) window.webContents.send(channel, payload)
  }
}
