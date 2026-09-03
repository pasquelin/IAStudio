/**
 * Opening the studio: everything a run spawned as one client's way in must never evaluate.
 *
 * Reached by `import()` so it lands in its own chunk — measured 2026-08-26, alternating series:
 * 241 ms to the way in's first answer before, 131 ms after, which is a bare Electron's own time.
 * The entry it leaves behind is 17 Ko, against 1,6 Mo.
 */
import { app, session } from 'electron'
import { APP_NAME } from '@shared/constants'
import { EVENTS } from '@shared/ipc'
import { registerAboutPanel } from '@main/aboutPanel'
import { APP_ICON_PATH } from '@main/resources'
import { buildMenu, noteNavigationPreset } from '@main/menu'
import { broadcast } from '@main/ipc/broadcast'
import { isDevelopment } from '@main/environment'
import { registerIpc } from '@main/ipc/register'
import { log, mirrorLogsTo, recordLogsTo } from '@main/log'
import { createLogFile, logsFolder } from '@main/logFile'
import { createServices, createSettings } from '@main/services'
import { createShutdown } from '@main/shutdown'
import type { SettingsStore } from '@main/settings/store'
import { registerFieldMenu } from '@main/window/contextMenu'
import { lockNavigation } from '@main/window/navigation'
import { lockPermissions, rendererOrigin } from '@main/window/permissions'
import { type Splash } from '@main/window/splash'
import { openSplashWindow } from '@main/window/splashWindow'
import { createMainWindow, showMainWindow } from '@main/window/windows'
import { offerExternalFiles, externalPathsFromArguments } from '@main/externalFiles'

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
      // Awaited among them: what is still queued is an append to a file the next launch reads
      // back, and a thread killed mid-write leaves a line nothing can parse.
      services.memory.close(),
      // Before the memories themselves have to be, and for a plainer reason: it holds a forked
      // process, and a `utilityProcess` nobody kills outlives the studio that forked it.
      services.memoryVectors.close(),
    ])
  }

  app.on('will-quit', createShutdown({ settle: settleBeforeQuit, quit: () => app.quit() }))

  // `deferShow`: the window stays hidden until the splash is gone, so one does not appear over
  // the other. Only a second launch overrides that — see `revealWindow`.
  const main = createMainWindow({ deferShow: true })

  const showOnceSplashIsGone = async (): Promise<void> => {
    await splash.finish()
    if (!main.isDestroyed()) main.show()
  }

  const reveal = (): void => void showOnceSplashIsGone()

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
  // Seeded here like the overrides above: `onChange` only fires on a WRITE, so without this the
  // ticked row lies on a stored preset and every row of it is inert until some other setting moves.
  noteNavigationPreset(services.settings.read().three, preset =>
    services.settings.write({
      three: { ...services.settings.read().three, navigationPreset: preset },
    }),
  )

  // Subscribed here, not beside the lock: reached any earlier, `showMainWindow` would find no
  // window yet and open one before `registerIpc` above — a renderer whose every `invoke` fails.
  // Never fires in development, where no lock is held: this path is exercised by a packaged run.
  app.on('second-instance', (_event, argv) => {
    showMainWindow()
    offerExternalFiles(externalPathsFromArguments(argv.slice(1)))
  })
}

/** Called once `index.ts` has registered the asset scheme, which `ready` would otherwise beat. */
export function bootstrap(): void {
  // Before any window, and every window is born below: one opened earlier would be created
  // outside the navigation lock and would hold no menu in its fields.
  lockNavigation()
  registerFieldMenu()

  void openWhenReady()

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

async function openWhenReady(): Promise<void> {
  await app.whenReady()
  // First, so what follows leaves a trace — but resolved on the first LINE, never here: a throw
  // on the way to the folder would take the splash and the permission lock with it.
  recordLogsTo(createLogFile(logsFolder))
  log.info('startup', `${APP_NAME} ${app.getVersion()} starting`)

  // The session only exists once ready, and no window may exist before it is locked: with no
  // handler installed Electron grants every permission a page asks for.
  lockPermissions(session.defaultSession, rendererOrigin())

  // Before the splash: it is painted from the theme, and reading the settings is a JSON file —
  // the rest of the services open SQLite synchronously, far too late to decide what to paint.
  const settings = createSettings()
  const splash = openSplashWindow()

  setImmediate(() => startUp(splash, settings))
}
