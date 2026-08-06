import { app, BrowserWindow } from 'electron'
import { resolveLanguage } from '@shared/i18n'
import { buildMenu } from '@main/menu'
import { registerAssetScheme } from '@main/assets/protocol'
import { registerIpc } from '@main/ipc/register'
import { createServices } from '@main/services'
import { lockNavigation } from '@main/window/navigation'
import { createMainWindow } from '@main/window/windows'

// Must run before the app is ready: afterwards Electron ignores it, `img-src scenario:` in
// the CSP is never honoured, and every local thumbnail comes back blank.
registerAssetScheme()

void app.whenReady().then(() => {
  lockNavigation()
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
