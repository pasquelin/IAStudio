import { BrowserWindow, nativeTheme } from 'electron'
import { SPLASH_BACKGROUND_COLOR, WINDOW_CHROME_COLOR } from '@shared/constants'
import type { ResolvedTheme, Theme } from '@shared/domain/settings'

/**
 * Hands the setting to Electron, whose `themeSource` takes the same three words. What it buys
 * is everything the stylesheet cannot reach: the title bar, the context menus, the native
 * dialogs and the scrollbars.
 *
 * It is also how `system` reaches the renderer at all — Chromium answers `prefers-color-scheme`
 * according to this, so the window follows without a second channel to keep in step.
 */
export function applyTheme(theme: Theme): void {
  nativeTheme.themeSource = theme
  repaintChrome()
}

/** What the theme resolves to right now, `system` included. */
function resolvedTheme(): ResolvedTheme {
  return nativeTheme.shouldUseDarkColors ? 'dark' : 'light'
}

/** The colour a window is painted before its first frame — see `WINDOW_CHROME_COLOR`. */
export function chromeColor(): string {
  return WINDOW_CHROME_COLOR[resolvedTheme()]
}

export function splashColor(): string {
  return SPLASH_BACKGROUND_COLOR[resolvedTheme()]
}

/**
 * `backgroundColor` is read when a window is created and never again, so a window already open
 * would keep the old colour showing through every resize until it is closed.
 */
function repaintChrome(): void {
  const color = chromeColor()
  for (const window of BrowserWindow.getAllWindows()) window.setBackgroundColor(color)
}
