/** URL fragment that tells the shared bundle it is rendering a player module. */
export const PLAYER_MODULE_ROUTE = 'player-module'

/**
 * The route a module's window loads, its asset included — ONE window turned towards whichever
 * module was opened, the way the character window is: comparing two is not what this is for.
 */
export function playerModuleRoute(assetId: string): string {
  return `${PLAYER_MODULE_ROUTE}/${encodeURIComponent(assetId)}`
}

export function isPlayerModuleRoute(hash: string): boolean {
  return hash.replace(/^#/, '').startsWith(`${PLAYER_MODULE_ROUTE}/`)
}

/**
 * The asset the fragment names, `null` for a fragment naming none — a window the system restores
 * finds its subject in its own URL, and a hand-edited one must open empty rather than white.
 */
export function playerModuleAssetOf(hash: string): string | null {
  if (!isPlayerModuleRoute(hash)) return null
  const encoded = hash.replace(/^#/, '').slice(`${PLAYER_MODULE_ROUTE}/`.length)
  if (encoded === '') return null

  try {
    return decodeURIComponent(encoded)
  } catch {
    return null
  }
}
