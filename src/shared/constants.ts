/**
 * Window chrome color, painted before the first render. It matches `--color-chassis`, the
 * outermost surface — not `--color-base`, which is the panels. Opaque on purpose: we judge
 * colors in this app, never through translucency (spec § 7).
 */
export const WINDOW_CHROME_COLOR = '#2b2d30'

export const APP_NAME = 'Scenario Studio'
