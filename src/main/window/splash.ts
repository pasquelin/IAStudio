import { app, BrowserWindow } from 'electron'
import { join } from 'node:path'
import { TRANSLATIONS, type Language } from '@shared/i18n'
import { EVENTS, type SplashStep } from '@shared/ipc'

/** A splash shown for 200 ms flickers, and reads as the opposite of a finished product. */
export const SPLASH_MINIMUM_MS = 700

/** Without it, a startup that never completes leaves a frameless window nothing can close. */
export const SPLASH_TIMEOUT_MS = 20000

const STEPS: readonly SplashStep[] = ['starting', 'catalog', 'project', 'workspace']

/** Injected so the sequencing is testable without a clock or an Electron window. */
export type SplashTiming = {
  now: () => number
  schedule: (callback: () => void, delay: number) => void
}

export type SplashController = {
  finish: () => void
}

/** What the window-backed splash adds: pushing a stage to the page. */
export type SplashWindow = SplashController & {
  step: (step: SplashStep) => void
}

export function createSplashController(timing: SplashTiming, close: () => void): SplashController {
  const startedAt = timing.now()
  let closed = false

  const closeOnce = (): void => {
    if (closed) return
    closed = true
    close()
  }

  timing.schedule(closeOnce, SPLASH_TIMEOUT_MS)

  return {
    finish: () => {
      const remaining = SPLASH_MINIMUM_MS - (timing.now() - startedAt)
      if (remaining <= 0) closeOnce()
      else timing.schedule(closeOnce, remaining)
    },
  }
}

/**
 * Frameless with native rounded corners rather than `transparent: true`: CLAUDE.md forbids
 * window transparency, and the native option gets the same shape without opening that door.
 *
 * Loads its own HTML entry, not a route of the main one: pulling in the 1.8 MB renderer
 * bundle would make the splash as slow to appear as what it exists to cover.
 */
export function openSplashWindow(language: Language): SplashWindow {
  const window = new BrowserWindow({
    width: 420,
    height: 260,
    frame: false,
    roundedCorners: true,
    resizable: false,
    show: false,
    center: true,
    skipTaskbar: true,
    backgroundColor: '#22242a',
    webPreferences: {
      preload: join(import.meta.dirname, '../preload/splash.cjs'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      devTools: false,
    },
  })

  // The version rides in the fragment: it never changes while the splash is up, so a second
  // IPC message would buy nothing.
  const hash = `${app.getVersion()} · ${__COMMIT_HASH__}`
  const devUrl = process.env['ELECTRON_RENDERER_URL']

  if (!app.isPackaged && devUrl) void window.loadURL(`${devUrl}/splash.html#${hash}`)
  else void window.loadFile(join(import.meta.dirname, '../renderer/splash.html'), { hash })

  window.once('ready-to-show', () => window.show())

  const controller = createSplashController(
    { now: () => Date.now(), schedule: (callback, delay) => void setTimeout(callback, delay) },
    () => {
      if (!window.isDestroyed()) window.close()
    },
  )

  // Startup is synchronous and fast: every stage would be sent before the page finished
  // loading, and dropped. Holding the latest one and pushing it on load is what makes the
  // splash say anything at all.
  let latest: SplashStep = 'starting'
  let loaded = false

  const push = (): void => {
    if (!loaded || window.isDestroyed()) return
    const label = TRANSLATIONS[language].splash[latest]
    window.webContents.send(EVENTS.splashStep, label, STEPS.indexOf(latest) + 1, STEPS.length)
  }

  window.webContents.once('did-finish-load', () => {
    loaded = true
    push()
  })

  return {
    ...controller,
    step: step => {
      latest = step
      push()
    },
  }
}
