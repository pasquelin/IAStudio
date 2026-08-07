import { app, BrowserWindow, type WebPreferences } from 'electron'
import { join } from 'node:path'
import { WINDOW_CHROME_COLOR } from '@shared/constants'
import { APP_ICON_PATH } from '@main/resources'
import { trackWindowState } from './controls'

/** Route the renderer reads to decide which window it is rendering. */
export const SETTINGS_ROUTE = 'settings'

/**
 * Identical for every window: a second window with weaker preferences would be a second, and
 * quieter, way to reach the bridge — see CLAUDE.md, invariant 1.
 */
const WEB_PREFERENCES: WebPreferences = {
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
const WINDOW_ICON: { icon?: string } = process.platform === 'darwin' ? {} : { icon: APP_ICON_PATH }

function load(window: BrowserWindow, route?: string): void {
  const devUrl = process.env['ELECTRON_RENDERER_URL']

  if (!app.isPackaged && devUrl) {
    void window.loadURL(route ? `${devUrl}#${route}` : devUrl)
    return
  }

  const file = join(import.meta.dirname, '../renderer/index.html')
  void window.loadFile(file, route ? { hash: route } : {})
}

export function createMainWindow(): BrowserWindow {
  const window = new BrowserWindow({
    width: 1440,
    height: 900,
    minWidth: 1024,
    minHeight: 640,
    show: false,
    backgroundColor: WINDOW_CHROME_COLOR,
    titleBarStyle: 'hiddenInset',
    trafficLightPosition: { x: 16, y: 14 },
    ...WINDOW_ICON,
    webPreferences: WEB_PREFERENCES,
  })

  trackWindowState(window)
  window.once('ready-to-show', () => window.show())
  load(window)

  return window
}

let settingsWindow: BrowserWindow | null = null

/**
 * Settings live in their own window, opened by ⌘,. One at a time: a second copy of the
 * account form could save a different key than the one the first is still showing.
 */
export function openSettingsWindow(): BrowserWindow {
  if (settingsWindow && !settingsWindow.isDestroyed()) {
    settingsWindow.focus()
    return settingsWindow
  }

  const window = new BrowserWindow({
    width: 760,
    height: 540,
    minWidth: 560,
    minHeight: 420,
    show: false,
    backgroundColor: WINDOW_CHROME_COLOR,
    titleBarStyle: 'hiddenInset',
    trafficLightPosition: { x: 12, y: 12 },
    // Not a document window: nothing here is worth a full screen, and macOS would otherwise
    // give it its own space, hiding the studio behind it.
    fullscreenable: false,
    ...WINDOW_ICON,
    webPreferences: WEB_PREFERENCES,
  })

  trackWindowState(window)
  window.once('ready-to-show', () => window.show())
  window.on('closed', () => {
    settingsWindow = null
  })

  load(window, SETTINGS_ROUTE)
  settingsWindow = window
  return window
}
