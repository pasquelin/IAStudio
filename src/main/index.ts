import { app, BrowserWindow } from 'electron'
import { APP_NAME } from '@shared/constants'
import { resolveLanguage } from '@shared/i18n'
import { EVENTS } from '@shared/ipc'
import { registerAboutPanel } from '@main/about-panel'
import { buildMenu } from '@main/menu'
import { registerAssetScheme } from '@main/assets/protocol'
import { broadcast } from '@main/ipc/broadcast'
import { registerIpc } from '@main/ipc/register'
import { mirrorLogsTo } from '@main/log'
import { createServices } from '@main/services'
import { lockNavigation } from '@main/window/navigation'
import { openSplashWindow } from '@main/window/splash-window'
import { createMainWindow } from '@main/window/windows'

// Before anything reads `app.getPath('userData')`: that path derives from the name, and a
// late call would have electron-store read one folder while writing to another.
app.setName(APP_NAME)

// Must run before the app is ready: afterwards Electron ignores it, `img-src scenario:` in
// the CSP is never honoured, and every local thumbnail comes back blank.
registerAssetScheme()

// At module scope, not inside `whenReady`: this hooks `web-contents-created`, so any window
// opened before it — the splash was — would be created outside the lock and keep none of it.
lockNavigation()

void app.whenReady().then(() => {
  const language = resolveLanguage(app.getLocale())
  const splash = openSplashWindow()

  /**
   * The API calls leave from here, so they never appear in the renderer's Network tab; the
   * mirror is what makes them, and the failures behind a reduced code, visible in devtools.
   *
   * Development only. Every line carries what the user typed and filtered by, and `broadcast`
   * sends to every window — including the settings window, which listens to none of it. The
   * terminal keeps the log in a packaged build; nothing crosses IPC.
   */
  if (!app.isPackaged) mirrorLogsTo(entry => broadcast(EVENTS.log, entry))

  // Before the window: the renderer's first `invoke` must find its handlers registered.
  registerIpc(createServices())

  // `did-finish-load` rather than `ready-to-show`: the main window is already visible by
  // then, so the splash never leaves a gap behind it.
  const main = createMainWindow()
  main.webContents.once('did-finish-load', () => splash.finish())

  // After the window, so Chromium starts parsing the renderer bundle sooner. Neither the
  // application menu nor the About panel is reachable before a window exists.
  registerAboutPanel(language)
  buildMenu(language)

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createMainWindow()
  })
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit()
})
