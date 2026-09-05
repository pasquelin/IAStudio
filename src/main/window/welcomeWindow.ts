import { BrowserWindow } from 'electron'
import { APP_ICON_PATH } from '@main/resources'
import { completedOnboarding, needsWelcome, WELCOME_ROUTE } from '@shared/domain/welcome'
import type { SettingsStore } from '@main/settings/store'
import { splashColor } from './theme'
import { revealWindow } from './reveal'
import { load, studioWindow, WEB_PREFERENCES } from './windows'

/**
 * A splash-shaped window: no chrome, native rounded corners, the mark's tile colour underneath.
 * Framed windows of this family keep a title bar; this one is the first thing a new install sees.
 *
 * 720 and not the 640 it opened with: the masthead took the height the carousel used to have, and
 * the account slide — four fields and a button, the tallest of the six — was clipped at both ends.
 * NOTHING scrolls here (Alban): a slide that does not fit is a slide to shorten, not to scroll.
 */
const WELCOME_SIZE = { width: 960, height: 720 }

const WINDOW_ICON = process.platform === 'darwin' ? undefined : APP_ICON_PATH

let welcomeWindow: BrowserWindow | null = null
let settingsStore: SettingsStore | null = null

export function bindWelcomeSettings(store: SettingsStore): void {
  settingsStore = store
}

function markSeen(): void {
  if (!settingsStore) return
  if (!needsWelcome(settingsStore.read().onboarding)) return
  settingsStore.write({ onboarding: completedOnboarding(new Date().toISOString()) })
}

function revealStudio(): void {
  const studio = studioWindow()
  if (studio && !studio.isDestroyed() && !studio.isVisible()) studio.show()
}

function dismissed(): void {
  markSeen()
  revealStudio()
}

export function openWelcomeWindow(options: { deferShow?: boolean } = {}): BrowserWindow {
  if (welcomeWindow && !welcomeWindow.isDestroyed()) {
    revealWindow(welcomeWindow)
    return welcomeWindow
  }

  const window = new BrowserWindow({
    ...WELCOME_SIZE,
    resizable: false,
    frame: false,
    roundedCorners: true,
    fullscreenable: false,
    show: false,
    center: true,
    backgroundColor: splashColor(),
    icon: WINDOW_ICON,
    webPreferences: WEB_PREFERENCES,
  })

  if (!options.deferShow) window.once('ready-to-show', () => window.show())
  load(window, { hash: WELCOME_ROUTE })

  welcomeWindow = window
  window.on('closed', () => {
    if (welcomeWindow === window) welcomeWindow = null
    dismissed()
  })
  return window
}
