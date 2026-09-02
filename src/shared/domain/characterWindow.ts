/**
 * The skeleton-and-animation window: one character, edited on its own.
 *
 * ONE window, never one per character — comparing two skeletons side by side is not what this is
 * for, so opening another turns this one towards it. The fragment names the asset all the same:
 * a window restored by the system has to find its subject again, and a channel replays nothing.
 */
export const CHARACTER_WINDOW_ROUTE = 'character'

/**
 * The route one character's window loads.
 *
 * Encoded for `fileInfoRoute`'s reason: an id is safe today, and a fragment that only happens to
 * be safe is one a wider id breaks in silence.
 */
export function characterWindowRoute(assetId: string): string {
  return `${CHARACTER_WINDOW_ROUTE}/${encodeURIComponent(assetId)}`
}

export function isCharacterWindowRoute(hash: string): boolean {
  return hash.replace(/^#/, '').startsWith(`${CHARACTER_WINDOW_ROUTE}/`)
}

/**
 * The asset the fragment names, `null` for a fragment naming none.
 *
 * `decodeURIComponent` throws on a malformed escape, and the fragment is the one input this side
 * does not build itself — a hand-edited URL must open empty rather than white.
 */
export function characterAssetOf(hash: string): string | null {
  const encoded = hash.replace(/^#/, '').slice(`${CHARACTER_WINDOW_ROUTE}/`.length)
  if (!isCharacterWindowRoute(hash) || encoded === '') return null

  try {
    return decodeURIComponent(encoded)
  } catch {
    return null
  }
}
