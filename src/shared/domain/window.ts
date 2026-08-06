/** État de la fenêtre, poussé par le main à chaque changement. */
export type WindowState = {
  /** Fenêtre au premier plan. */
  active: boolean
  fullScreen: boolean
  maximized: boolean
}

export const INITIAL_WINDOW_STATE: WindowState = {
  active: true,
  fullScreen: false,
  maximized: false,
}
