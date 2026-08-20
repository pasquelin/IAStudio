/** Window state, pushed by the main process on every change. */
export type WindowState = {
  /** Window is frontmost. */
  active: boolean
  fullScreen: boolean
  maximized: boolean
}

export const INITIAL_WINDOW_STATE: WindowState = {
  active: true,
  fullScreen: false,
  maximized: false,
}

/**
 * The three the Help menu offers, each a window of its own rather than a panel — see
 * `openManualWindow` and its two neighbours, which say why each one is not a dock.
 */
export type HelpPage = 'manual' | 'licences' | 'usage'

export const HELP_PAGES: readonly HelpPage[] = ['manual', 'licences', 'usage']
