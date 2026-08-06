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
