import { app, BrowserWindow } from 'electron'
import { resolveLanguage } from '@shared/i18n'
import { EVENTS } from '@shared/ipc'
import { buildMenu } from '@main/menu'
import { registerAssetScheme } from '@main/assets/protocol'
import { broadcast } from '@main/ipc/broadcast'
import { registerIpc } from '@main/ipc/register'
import { mirrorLogsTo } from '@main/log'
import { createServices } from '@main/services'
import { lockNavigation } from '@main/window/navigation'
import { createMainWindow } from '@main/window/windows'

// Must run before the app is ready: afterwards Electron ignores it, `img-src scenario:` in
// the CSP is never honoured, and every local thumbnail comes back blank.
registerAssetScheme()

void app.whenReady().then(() => {
  lockNavigation()
  /**
   * The API calls leave from here, so they never appear in the renderer's Network tab; the
   * mirror is what makes them, and the failures behind a reduced code, visible in devtools.
   *
   * Development only. Every line carries what the user typed and filtered by, and `broadcast`
   * sends to every window — including the settings window, which listens to none of it. The
   * terminal keeps the log in a packaged build; nothing crosses IPC.
   */
  if (!app.isPackaged) mirrorLogsTo(entry => broadcast(EVENTS.log, entry))
  registerIpc(createServices())
  buildMenu(resolveLanguage(app.getLocale()))
  createMainWindow()

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createMainWindow()
  })
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit()
})
