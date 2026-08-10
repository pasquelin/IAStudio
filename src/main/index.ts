import { app, session } from 'electron'
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
import { lockPermissions, rendererOrigin } from '@main/window/permissions'
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
  //
  // Electron only waits for this if it is told to. Without the `preventDefault`, the process is
  // torn down while the round trip to the catalogue thread is still out, and the line this is
  // here to save is the one that goes.
  let leaving = false
  app.on('before-quit', event => {
    if (leaving) return

    event.preventDefault()
    leaving = true
    // Not awaited with the rest: the recognition process holds no state worth settling, and a
    // model still loading would otherwise keep the studio on screen for seconds.
    services.dictation.dispose()
    // The note of what is still running goes out with the journal: a job whose submission
    // landed in the last moments would otherwise be lost, and it has already been paid for.
    // The manifest stamp joins them — quitting right after a save is the ordinary way to do it.
    void Promise.all([
      services.journal.flush(),
      services.flushJobs(),
      services.project.settled(),
    ]).finally(() => app.quit())
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
    // The session only exists once ready, and no window may exist before it is locked: with no
    // handler installed Electron grants every permission a page asks for.
    lockPermissions(session.defaultSession, rendererOrigin())

    // Before the splash: it is painted from the theme, and reading the settings is a JSON file —
    // the rest of the services open SQLite synchronously, far too late to decide what to paint.
    const settings = createSettings()
    const splash = openSplashWindow()

    setImmediate(() => startUp(splash, settings))
  })

  /**
   * Closing the last window quits, on macOS as everywhere else. That is NOT the platform
   * convention — a Mac app usually outlives its windows and reopens one from the Dock — but the
   * studio is a document editor with nothing to offer once its windows are gone, and staying
   * resident left an application running with no way to see it.
   *
   * Safe during start-up: the main window is created before the splash is ever dismissed, so
   * there is no moment where zero windows exist and the launch quits itself.
   */
  app.on('window-all-closed', () => app.quit())
}

// One studio per machine: two would share one settings file and one WAL catalogue opened
// without a busy timeout. Must stay below `setName` — the lock file lives under `userData`.
if (app.requestSingleInstanceLock()) bootstrap()
else app.quit()
