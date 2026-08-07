/**
 * Studio tokens, read off a mounted element. The palette is declared once, in `index.css`; a hex
 * value copied into an engine would leave its viewport on the old grey the day the token changes,
 * and it would be the one surface in the application that never follows.
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
