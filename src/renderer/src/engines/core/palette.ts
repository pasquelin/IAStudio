/**
 * Studio tokens, read off a mounted element. The palette is declared once, in `index.css`; a hex
 * value copied into an engine would leave its viewport on the old grey the day the token changes,
 * and it would be the one surface in the application that never follows.
 *
 * **A token computed from another one has to be REGISTERED to be read here.** An unregistered
 * custom property computes to its own text with variables substituted and nothing evaluated, so
 * `--text-tiny` would answer `calc(11px * 1)` rather than `11px`. The ladder is declared
 * `@property … syntax: '<length>'` in `index.css` for exactly this; a token added later in terms
 * of another must be too, or its reader gets a string no canvas and no number will take.
 */

/** An empty string means the token is missing — the caller decides what to fall back to. */
export function token(element: Element, name: string): string {
  return getComputedStyle(element).getPropertyValue(name).trim()
}

/**
 * The same token as a number, for the engines whose API takes `0xrrggbb`. Returns `fallback`
 * for a missing or unparsable token rather than a silent black.
 */
export function tokenAsHex(element: Element, name: string, fallback: number): number {
  const value = token(element, name)
  if (!value.startsWith('#')) return fallback
  const parsed = Number.parseInt(value.slice(1), 16)
  return Number.isNaN(parsed) ? fallback : parsed
}

/**
 * A canvas font shorthand whose SIZE is a token and whose family is the caller's — no token names
 * a family for a canvas, and reading `--font-sans` would change the face a painter draws with.
 *
 * `fallbackSize` is the step at scale 1, for an element not yet in a document: a shorthand with
 * no size is rejected whole by the 2D context, which then keeps the font it had, and nothing on
 * screen says so.
 */
export function tokenAsFont(
  element: Element,
  name: string,
  fallbackSize: string,
  family: string,
): string {
  return `${token(element, name) || fallbackSize} ${family}`
}

type PaletteListener = () => void

const listeners = new Set<PaletteListener>()

const cache = new Map<string, string>()

/**
 * A root token, read once per theme instead of once per caller. `getComputedStyle` resolves
 * style over the whole shell, so the readers that run often — a log line, an inspector
 * re-rendering on every frame of a drag — must not each pay for it.
 *
 * Only for tokens hanging off `:root`. An engine reading from its own canvas keeps `token`:
 * the element has to be in the document for the studio tokens to reach it at all.
 */
export function cachedToken(name: string): string {
  const known = cache.get(name)
  if (known !== undefined) return known

  const value = typeof document === 'undefined' ? '' : token(document.documentElement, name)
  cache.set(name, value)
  return value
}

/**
 * Called when the theme changes. Engines subscribe when they are built and drop it when they
 * are destroyed; caches subscribe once, at module level.
 *
 * A registry rather than a DOM event: engines carry no knowledge of React and no less of
 * `window`, three of them cache these tokens for good reasons, and each one having its own way
 * to hear about a theme change is how one of them ends up being the surface that never follows.
 *
 * Returns the unsubscribe.
 */
export function onPaletteChange(listener: PaletteListener): () => void {
  listeners.add(listener)
  return () => void listeners.delete(listener)
}

/**
 * One call when the theme moves: every cache drops and every live engine repaints. Called after
 * the attribute is published, never before — the listeners read the tokens back immediately,
 * and `getComputedStyle` would hand them the palette they are leaving.
 */
export function refreshPalette(): void {
  cache.clear()
  for (const listener of listeners) listener()
}
