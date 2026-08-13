import { BrowserWindow, dialog, screen, type WebPreferences } from 'electron'
import { join } from 'node:path'
import { chromeColor } from './theme'
import { LICENCES_ROUTE } from '@shared/domain/licence'
import { settingsRoute, type SettingsSectionId } from '@shared/domain/settings'
import { USAGE_ROUTE } from '@shared/domain/usage'
import { TRANSLATIONS } from '@shared/i18n'
import { EVENTS } from '@shared/ipc'
import { APP_ICON_PATH } from '@main/resources'
import { isDevelopment } from '@main/environment'
import { trackWindowState } from './controls'
import { windowLanguage } from './language'
import { revealWindow } from './reveal'

/**
 * The floor below which the layout stops being usable: the two rails take 96 px, the side
 * columns roughly 250 and 300, and the video workspace puts a source and a program viewer side
 * by side in what is left — under 1280 they become thumbnails. Height is the same argument
 * stacked: workspace bar, tabs, viewer, timeline and status bar. Resolve asks for the same.
 */
const LAYOUT_FLOOR = { width: 1280, height: 720 }

/**
 * The floor for every window: none may weaken these — a second window with looser settings
 * would be a second, quieter way to reach the bridge (CLAUDE.md, invariant 1). The splash
 * spreads them and tightens further, dropping the preload entirely.
 */
export const WEB_PREFERENCES: WebPreferences = {
  preload: join(import.meta.dirname, '../preload/index.cjs'),
  contextIsolation: true,
  nodeIntegration: false,
  sandbox: true,
  // Dropping the menu entries hides the command; this refuses the feature. A compromised
  // dependency calling `openDevTools()` would otherwise still reach `window.studio`.
  devTools: isDevelopment,
}

/**
 * macOS reads the icon from the bundle and ignores this option; Windows and Linux need it
 * spelled out, or the window wears the default Electron icon.
 */
const WINDOW_ICON = process.platform === 'darwin' ? undefined : APP_ICON_PATH

/**
 * Where the renderer lives, in one place. Dev serves it, a packaged build reads it from disk,
 * and both assume `out/renderer/` sits beside `out/main/` — an assumption worth stating once.
 */
export function load(window: BrowserWindow, options: { entry?: string; hash?: string } = {}): void {
  const { entry = 'index.html', hash } = options
  const devUrl = process.env['ELECTRON_RENDERER_URL']

  if (isDevelopment && devUrl) {
    const base = entry === 'index.html' ? devUrl : `${devUrl}/${entry}`
    void window.loadURL(hash ? `${base}#${hash}` : base)
    return
  }

  const file = join(import.meta.dirname, '../renderer', entry)
  void window.loadFile(file, hash ? { hash } : {})
}

/** What separates one auxiliary window from the next. Everything else about them is identical. */
type AuxiliarySize = { width: number; height: number; minWidth: number; minHeight: number }

/**
 * The shape shared by every window that is not a document: a size typed here rather than taken
 * from the screen, and no full screen — macOS would give it a space of its own, hiding the studio
 * behind it.
 *
 * Written once because it was written three times: settings, licences and usage differed only by
 * their four numbers, and a floor added to one of them silently left the other two behind.
 */
function auxiliaryWindow(size: AuxiliarySize): BrowserWindow {
  const window = new BrowserWindow({
    ...size,
    show: false,
    backgroundColor: chromeColor(),
    titleBarStyle: 'hiddenInset',
    trafficLightPosition: { x: 12, y: 12 },
    fullscreenable: false,
    icon: WINDOW_ICON,
    webPreferences: WEB_PREFERENCES,
  })

  trackWindowState(window)
  window.once('ready-to-show', () => window.show())
  return window
}

/**
 * The windows there is only ever one of, held by the route that identifies them — a route is what
 * the window IS here, and no two auxiliary windows share one.
 */
const auxiliaryWindows = new Map<string, BrowserWindow>()

/**
 * Reveals the window a route already has, or builds it. Settings does not come through here: it
 * carries a section to announce and a close it may refuse, neither of which the other two have.
 */
function openAuxiliaryWindow(hash: string, size: AuxiliarySize): BrowserWindow {
  const held = auxiliaryWindows.get(hash)
  if (held && !held.isDestroyed()) {
    revealWindow(held)
    return held
  }

  const window = auxiliaryWindow(size)
  // Identity-checked, as `createMainWindow` is: an older window closing must not clear a slot a
  // newer one now holds.
  window.on('closed', () => {
    if (auxiliaryWindows.get(hash) === window) auxiliaryWindows.delete(hash)
  })

  load(window, { hash })
  auxiliaryWindows.set(hash, window)
  return window
}

let mainWindow: BrowserWindow | null = null

/**
 * `deferShow` hands the decision to the caller instead of showing on `ready-to-show`. Startup
 * uses it so the window waits for the splash to be gone: two windows on screen at once, one
 * over the other, is what a splash is supposed to prevent.
 */
export function createMainWindow(options: { deferShow?: boolean } = {}): BrowserWindow {
  /**
   * The screen decides the size, not a number typed here: a studio opens filled.
   *
   * `workArea` and not `size`: the latter is the panel itself, menu bar and Dock included, and
   * a window given those numbers hides part of itself behind both. Its `x`/`y` come along —
   * on a second display the work area does not start at the origin.
   *
   * Not `maximize()`: that is a window STATE, and macOS restores out of it to whatever size
   * was set before — which would be this same one. One mechanism, not two.
   */
  const { workArea } = screen.getPrimaryDisplay()

  const window = new BrowserWindow({
    ...workArea,
    // Never above the screen itself: Electron RAISES a window to its minimum size, so a floor
    // wider than a 1024-wide display would push a quarter of the window off it, with no way to
    // resize back. The floor is a limit on shrinking, not a demand for room that is not there.
    minWidth: Math.min(LAYOUT_FLOOR.width, workArea.width),
    minHeight: Math.min(LAYOUT_FLOOR.height, workArea.height),
    show: false,
    backgroundColor: chromeColor(),
    titleBarStyle: 'hiddenInset',
    trafficLightPosition: { x: 16, y: 14 },
    icon: WINDOW_ICON,
    webPreferences: WEB_PREFERENCES,
  })

  trackWindowState(window)

  if (!options.deferShow) window.once('ready-to-show', () => window.show())
  load(window)

  mainWindow = window
  // Identity-checked: an older window closing must not clear a slot a newer one now holds.
  window.on('closed', () => {
    if (mainWindow === window) mainWindow = null
  })

  return window
}

/**
 * Answers a second launch. On macOS every window can be closed while the process stays in the
 * Dock, so there may be nothing left to reveal.
 */
export function showMainWindow(): void {
  if (mainWindow && !mainWindow.isDestroyed()) revealWindow(mainWindow)
  else createMainWindow()
}

let settingsWindow: BrowserWindow | null = null

/**
 * Names the section to the window's renderer, waiting for it to be loaded if it is not yet.
 * `send` on a renderer still parsing its bundle is dropped without a trace — the subscription
 * it would have reached does not exist until React has mounted.
 */
function showSection(window: BrowserWindow, section: SettingsSectionId): void {
  const { webContents } = window

  if (webContents.isLoading()) {
    webContents.once('did-finish-load', () => webContents.send(EVENTS.settingsSection, section))
    return
  }

  webContents.send(EVENTS.settingsSection, section)
}

/**
 * Settings live in their own window, opened by ⌘,. One at a time: a second copy of the
 * account form could save a different key than the one the first is still showing.
 *
 * `section` is what a panel asks for when it sends the user here — the account form, from a
 * panel that has just said no API key is set.
 */
/**
 * Whether the settings window is holding changes nobody applied. Published by its renderer,
 * because closing a window is the main process's decision and it has no other way to know.
 */
let settingsPending = false

export function markSettingsPending(pending: boolean): void {
  settingsPending = pending
}

export function openSettingsWindow(section?: SettingsSectionId): BrowserWindow {
  if (settingsWindow && !settingsWindow.isDestroyed()) {
    // Already open, possibly on another section: reloading it would throw away a half-typed
    // key, so the window is told to move rather than sent back through its route.
    if (section) showSection(settingsWindow, section)

    revealWindow(settingsWindow)
    return settingsWindow
  }

  const window = auxiliaryWindow({ width: 760, height: 540, minWidth: 560, minHeight: 420 })

  /**
   * Nothing is written until Apply, so closing on a pending buffer throws the work away in
   * silence. Two choices rather than three: applying from here would mean asking the renderer
   * to do it and waiting for the answer, when going back and clicking Apply is one click.
   *
   * `showMessageBoxSync` because `close` cannot be awaited — the window would already be gone.
   */
  window.on('close', event => {
    if (!settingsPending) return

    const t = TRANSLATIONS[windowLanguage()].settings
    const chosen = dialog.showMessageBoxSync(window, {
      type: 'warning',
      message: t.discardTitle,
      detail: t.discardBody,
      // Cancel first, and as the default: the safe answer is the one a stray Return should give.
      buttons: [t.cancel, t.discard],
      defaultId: 0,
      cancelId: 0,
    })

    if (chosen === 0) event.preventDefault()
    else settingsPending = false
  })

  window.on('closed', () => {
    settingsPending = false
    settingsWindow = null
  })

  load(window, { hash: settingsRoute(section) })
  settingsWindow = window
  return window
}

/**
 * The notice the licences of everything shipped ask for, as its own window rather than a
 * settings section: it is read once, printed or copied from, and belongs beside About in Help
 * — not among things one changes.
 */
export function openLicencesWindow(): BrowserWindow {
  return openAuxiliaryWindow(LICENCES_ROUTE, {
    width: 720,
    height: 600,
    minWidth: 480,
    minHeight: 360,
  })
}

/**
 * What every stored key has spent, as its own window rather than a panel: it is read on its
 * own, not while working, and none of it belongs beside a document.
 *
 * Wider than the licences window — four sections, tables and charts side by side.
 */
export function openUsageWindow(): BrowserWindow {
  return openAuxiliaryWindow(USAGE_ROUTE, {
    width: 900,
    height: 620,
    minWidth: 680,
    minHeight: 440,
  })
}
