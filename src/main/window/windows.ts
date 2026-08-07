import { app, BrowserWindow, type WebPreferences } from 'electron'
import { join } from 'node:path'
import { chromeColor } from './theme'
import { settingsRoute, type SettingsSectionId } from '@shared/domain/settings'
import { EVENTS } from '@shared/ipc'
import { APP_ICON_PATH } from '@main/resources'
import { trackWindowState } from './controls'

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
  devTools: !app.isPackaged,
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

  if (!app.isPackaged && devUrl) {
    const base = entry === 'index.html' ? devUrl : `${devUrl}/${entry}`
    void window.loadURL(hash ? `${base}#${hash}` : base)
    return
  }

  const file = join(import.meta.dirname, '../renderer', entry)
  void window.loadFile(file, hash ? { hash } : {})
}

/**
 * `deferShow` hands the decision to the caller instead of showing on `ready-to-show`. Startup
 * uses it so the window waits for the splash to be gone: two windows on screen at once, one
 * over the other, is what a splash is supposed to prevent.
 */
export function createMainWindow(options: { deferShow?: boolean } = {}): BrowserWindow {
  const window = new BrowserWindow({
    width: 1440,
    height: 900,
    minWidth: 1024,
    minHeight: 640,
    show: false,
    backgroundColor: chromeColor(),
    titleBarStyle: 'hiddenInset',
    trafficLightPosition: { x: 16, y: 14 },
    icon: WINDOW_ICON,
    webPreferences: WEB_PREFERENCES,
  })

  trackWindowState(window)

  // Filled, not full screen: a studio wants the whole screen, but macOS full screen moves the
  // window to a space of its own, where the finder, the browser and the reference images the
  // work is being done against are no longer reachable. The size above stays the restored one.
  window.maximize()

  if (!options.deferShow) window.once('ready-to-show', () => window.show())
  load(window)

  return window
}

let settingsWindow: BrowserWindow | null = null

/**
 * Settings live in their own window, opened by ⌘,. One at a time: a second copy of the
 * account form could save a different key than the one the first is still showing.
 *
 * `section` is what a panel asks for when it sends the user here — the account form, from a
 * panel that has just said no API key is set.
 */
export function openSettingsWindow(section?: SettingsSectionId): BrowserWindow {
  if (settingsWindow && !settingsWindow.isDestroyed()) {
    // Already open, possibly on another section: reloading it would throw away a half-typed
    // key, so the window is told to move rather than sent back through its route.
    if (section) settingsWindow.webContents.send(EVENTS.settingsSection, section)
    settingsWindow.focus()
    return settingsWindow
  }

  const window = new BrowserWindow({
    width: 760,
    height: 540,
    minWidth: 560,
    minHeight: 420,
    show: false,
    backgroundColor: chromeColor(),
    titleBarStyle: 'hiddenInset',
    trafficLightPosition: { x: 12, y: 12 },
    // Not a document window: nothing here is worth a full screen, and macOS would otherwise
    // give it its own space, hiding the studio behind it.
    fullscreenable: false,
    icon: WINDOW_ICON,
    webPreferences: WEB_PREFERENCES,
  })

  trackWindowState(window)
  window.once('ready-to-show', () => window.show())
  window.on('closed', () => {
    settingsWindow = null
  })

  load(window, { hash: settingsRoute(section) })
  settingsWindow = window
  return window
}
