import type { StudioBridge } from '@shared/ipc'

/**
 * Single accessor for the preload bridge. It is absent in tests and in a plain browser, and
 * repeating `typeof studio === 'undefined'` in every hook would spread that knowledge — and
 * would contradict the global declaration, which types `studio` as always present.
 */
export function getBridge(): StudioBridge | null {
  return typeof studio === 'undefined' ? null : studio
}

/**
 * The version half of the bridge, answered as something that may not be there.
 *
 * The global types it as always present, and in a shipped application it is: preload and renderer
 * come out of one build. In DEVELOPMENT they do not have to — a window whose preload predates a
 * branch has every other half and not this one, and `getBridge()?.git.read()` then throws where
 * every caller was written expecting a bridge that answers nothing. Measured on 17 August: the
 * panel stayed on its opening state and said no project was open, over an open project, while
 * the console filled with `Cannot read properties of undefined`.
 */
export function gitBridge(): StudioBridge['git'] | undefined {
  return getBridge()?.git
}
