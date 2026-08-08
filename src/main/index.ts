import { app, BrowserWindow } from 'electron'
import { APP_NAME } from '@shared/constants'
import { EVENTS } from '@shared/ipc'
import { registerAboutPanel } from '@main/about-panel'
import { APP_ICON_PATH } from '@main/resources'
import { buildMenu } from '@main/menu'
import { registerAssetScheme } from '@main/assets/protocol'
import { broadcast } from '@main/ipc/broadcast'
import { isDevelopment } from '@main/environment'
import { registerIpc } from '@main/ipc/register'
import { log, mirrorLogsTo } from '@main/log'
import { createServices, createSettings } from '@main/services'
import type { SettingsStore } from '@main/settings/store'
import { lockNavigation } from '@main/window/navigation'
import { type Splash } from '@main/window/splash'
import { openSplashWindow } from '@main/window/splash-window'
import { createMainWindow, showMainWindow } from '@main/window/windows'

// Before anything reads `app.getPath('userData')`: that path derives from the name, and a
// late call would have electron-store read one folder while writing to another.
app.setName(APP_NAME)

/**
 * Everything below blocks the main loop from end to end — `createServices()` opens SQLite
 * synchronously. Deferred by one turn so the splash gets its frame first; without it the
 * splash surfaces once the work it covers is already finished.
 */
function startUp(splash: Splash, settings: SettingsStore): void {
  /**
   * The API calls leave from here, so they never appear in the renderer's Network tab; the
   * mirror is what makes them, and the failures behind a reduced code, visible in devtools.
   *
   * Development only. Every line carries what the user typed and filtered by, and `broadcast`
   * sends to every window — including the settings window, which listens to none of it. The
   * terminal keeps the log in a packaged build; nothing crosses IPC.
   */
  if (isDevelopment) mirrorLogsTo(entry => broadcast(EVENTS.log, entry))

  // An unpackaged run wears the Electron bundle's own identity, so the Dock shows Electron's
  // atom instead of this application's mark. The icon can be replaced at runtime; the name
  // beside it cannot — macOS reads that from the bundle, and it is right in a packaged build.
  if (isDevelopment && process.platform === 'darwin') app.dock?.setIcon(APP_ICON_PATH)

  // Before the window: the renderer's first `invoke` must find its handlers registered.
  const services = createServices(settings)
  registerIpc(services)

  // Fire and forget: whether a newer version exists has no bearing on the window opening, and
  // a check that fails leaves the studio exactly as usable as it was.
  void services.updates.check()

  // The journal batches, so up to a flush's worth of it is still in memory at any moment — and
  // the most ordinary way to lose it is the one that matters: an export fails, the user quits.
  app.on('before-quit', () => {
    void services.journal.flush()
  })

  // `deferShow`: the window stays hidden until the splash is gone, so one does not appear over
  // the other. Only a second launch overrides that — see `revealWindow`.
  const main = createMainWindow({ deferShow: true })

  const reveal = (): void => {
    void splash.finish().then(() => {
      if (!main.isDestroyed()) main.show()
    })
  }

  main.once('ready-to-show', reveal)

  // Without this the window would stay hidden forever: `window-all-closed` never fires, so
  // the process lives on with no UI and macOS `activate` refuses to reopen anything.
  main.webContents.once('did-fail-load', (_event, code, description) => {
    log.error('renderer', `main window failed to load (${code}): ${description}`)
    reveal()
  })

  // After the window, so Chromium starts parsing the renderer bundle sooner. Neither the
  // application menu nor the About panel is reachable before a window exists.
  const language = services.language()
  registerAboutPanel(language)
  buildMenu(language, services.settings.read().shortcuts.overrides)

  // Subscribed here, not beside the lock: reached any earlier, `showMainWindow` would find no
  // window yet and open one before `registerIpc` above — a renderer whose every `invoke` fails.
  app.on('second-instance', showMainWindow)
}

function bootstrap(): void {
  // Must run before the app is ready: afterwards Electron ignores it, `img-src scenario:` in
  // the CSP is never honoured, and every local thumbnail comes back blank.
  registerAssetScheme()

  // Before any window: this hooks `web-contents-created`, so a window opened earlier would be
  // created outside the lock and keep none of it.
  lockNavigation()

  void app.whenReady().then(() => {
    // Before the splash: it is painted from the theme, and reading the settings is a JSON file —
    // the rest of the services open SQLite synchronously, far too late to decide what to paint.
    const settings = createSettings()
    const splash = openSplashWindow()

    setImmediate(() => startUp(splash, settings))

    app.on('activate', () => {
      if (BrowserWindow.getAllWindows().length === 0) createMainWindow()
    })
  })

  app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') app.quit()
  })
}

// One studio per machine: two would share one settings file and one WAL catalogue opened
// without a busy timeout. Must stay below `setName` — the lock file lives under `userData`.
if (app.requestSingleInstanceLock()) bootstrap()
else app.quit()
