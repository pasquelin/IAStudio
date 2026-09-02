import { hashPayload, hashRoute } from './hashPayload'

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
  return hashRoute(CHARACTER_WINDOW_ROUTE, assetId)
}

export function isCharacterWindowRoute(hash: string): boolean {
  return hash.replace(/^#/, '').startsWith(`${CHARACTER_WINDOW_ROUTE}/`)
}

/** The asset the fragment names, `null` for a fragment naming none. */
export function characterAssetOf(hash: string): string | null {
  return hashPayload(hash, CHARACTER_WINDOW_ROUTE)
}
