import { app, BrowserWindow } from 'electron'
import { SPLASH_BACKGROUND_COLOR } from '@shared/constants'
import { createSplashController, type Splash } from './splash'
import { WEB_PREFERENCES, load } from './windows'

/**
 * Frameless with native rounded corners rather than `transparent: true`: CLAUDE.md forbids
 * window transparency, and the native option gets the same shape without opening that door.
 *
 * Its own HTML entry, not a route of the main one: pulling in the renderer bundle would make
 * the splash as slow to appear as what it exists to cover.
 *
 * No progress steps. Startup is synchronous, so every stage would land in the same tick and
 * only the last could ever be painted — a channel, a preload and eight translations to show
 * one constant string. The bar is indeterminate instead, which is also the honest reading.
 */
export function openSplashWindow(): Splash {
  let window: BrowserWindow | null = new BrowserWindow({
    width: 420,
    height: 260,
    frame: false,
    roundedCorners: true,
    resizable: false,
    show: false,
    center: true,
    skipTaskbar: true,
    backgroundColor: SPLASH_BACKGROUND_COLOR,
    // Spread rather than retyped: `WEB_PREFERENCES` carries the guarantee that no window
    // reaches the bridge with weaker settings. The splash needs no bridge at all.
    webPreferences: { ...WEB_PREFERENCES, preload: undefined, devTools: false },
  })

  window.once('ready-to-show', () => window?.show())
  load(window, { entry: 'splash.html', hash: `${app.getVersion()} · ${__COMMIT_HASH__}` })

  return createSplashController(
    {
      now: () => Date.now(),
      schedule: (callback, delay) => {
        const timer = setTimeout(callback, delay)
        return () => clearTimeout(timer)
      },
    },
    () => {
      if (window && !window.isDestroyed()) window.close()
      // Dropped so closing frees the wrapper instead of waiting for the last closure to die.
      window = null
    },
  )
}
