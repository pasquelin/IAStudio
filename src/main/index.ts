import { app, session } from 'electron'
import { APP_NAME } from '@shared/constants'
import { EVENTS } from '@shared/ipc'
import { registerAboutPanel } from '@main/aboutPanel'
import { APP_ICON_PATH } from '@main/resources'
import { buildMenu } from '@main/menu'
import { registerAssetScheme } from '@main/assets/protocol'
import { broadcast } from '@main/ipc/broadcast'
import { isDevelopment } from '@main/environment'
import { registerIpc } from '@main/ipc/register'
import { log, mirrorLogsTo, recordLogsTo } from '@main/log'
import { createLogFile } from '@main/logFile'
import { createServices, createSettings } from '@main/services'
import { createShutdown } from '@main/shutdown'
import type { SettingsStore } from '@main/settings/store'
import { registerFieldMenu } from '@main/window/contextMenu'
import { lockNavigation } from '@main/window/navigation'
import { lockPermissions, rendererOrigin } from '@main/window/permissions'
import { type Splash } from '@main/window/splash'
import { openSplashWindow } from '@main/window/splashWindow'
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

  /**
   * The way in from outside follows the setting from here on — and is applied straight away with
   * the settings as they stand. Subscribing alone would only ever hear a CHANGE, so a user who
   * left it on would find nothing listening until they toggled it twice.
   */
  services.mcp.apply(settings.read())
  settings.subscribe(services.mcp.apply)

  // The journal batches, so up to a flush's worth of it is still in memory at any moment — and
  // the most ordinary way to lose it is the one that matters: an export fails, the user quits.
  const settleBeforeQuit = (): Promise<unknown> => {
    // Not awaited with the rest: the recognition process holds no state worth settling, and a
    // model still loading would otherwise keep the studio on screen for seconds.
    services.dictation.dispose()
    // The note of what is still running goes out with the journal: a job whose submission
    // landed in the last moments would otherwise be lost, and it has already been paid for.
    // The manifest stamp joins them — quitting right after a save is the ordinary way to do it.
    //
    // The MCP server is AWAITED among them, not fired off beside them: the file it removes names
    // a port, and a removal racing `app.quit()` leaves that file pointing the next client at
    // whatever takes the port after this process is gone. `void` here undid the very thing it
    // claimed to do.
    return Promise.all([
      services.disposeAiEngine(),
      services.journal.flush(),
      services.flushJobs(),
      services.project.settled(),
      services.mcp.stop(),
    ])
  }

  app.on('will-quit', createShutdown({ settle: settleBeforeQuit, quit: () => app.quit() }))

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
  registerAboutPanel()
  buildMenu(services.settings.read().shortcuts.overrides)

  // Subscribed here, not beside the lock: reached any earlier, `showMainWindow` would find no
  // window yet and open one before `registerIpc` above — a renderer whose every `invoke` fails.
  // Never fires in development, where no lock is held: this path is exercised by a packaged run.
  app.on('second-instance', showMainWindow)
}

function bootstrap(): void {
  // Must run before the app is ready: afterwards Electron ignores it, `img-src ia-studio:` in
  // the CSP is never honoured, and every local thumbnail comes back blank.
  registerAssetScheme()

  // Before any window: this hooks `web-contents-created`, so a window opened earlier would be
  // created outside the lock and keep none of it.
  lockNavigation()

  // Beside it, and for the same reason: a window created before this runs would hold no menu in
  // its fields, and nothing would say so.
  registerFieldMenu()

  void app.whenReady().then(() => {
    // First, so what follows leaves a trace — but resolved on the first LINE, never here: a throw
    // on the way to the folder would take the splash and the permission lock with it.
    // `setAppLogsPath()` is what defines the path at all on Linux and Windows.
    recordLogsTo(
      createLogFile(() => {
        app.setAppLogsPath()
        return app.getPath('logs')
      }),
    )
    log.info('startup', `${APP_NAME} ${app.getVersion()} starting`)

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
//
// Development starts anyway, and that is what keeps hot reload alive: a rebuild of anything the
// main process bundles — `shared/` included, so a translation counts — makes electron-vite kill
// this process and start the next in the same breath. Electron takes seconds to die, so the new
// one finds the lock still held; exiting here would make electron-vite take the dev server down
// with us, and the window left on screen would point at a server that no longer answers.
//
// Said out loud rather than waved through: the overlap is usually the second or two an old
// process needs to die, but two `pnpm start` runs — one per worktree, which this repository
// invites — overlap for as long as both are up, and they then reopen the same project catalogue.
// SQLite takes one writer; the loser comes back with no project open, and `services` reduces
// that to a warning. Without this line nothing anywhere would say why.
if (app.requestSingleInstanceLock()) bootstrap()
else if (isDevelopment) {
  log.warn('startup', 'another studio holds the single-instance lock: starting anyway (dev)')
  bootstrap()
} else app.quit()
