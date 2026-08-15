import { ASSET_NAME_MAX_LENGTH } from './asset'

/**
 * Naming an asset. Read by both sides for the reason `checkDocumentName` is: the field says no
 * while the name is being typed, and the main process refuses what it is handed regardless.
 *
 * Shorter than the document's list, and deliberately: an asset's name is not a file name — its
 * file is called after its id, and always has been — so nothing here is about separators, and
 * two assets may perfectly well share a name. Only emptiness and length can be wrong.
 */
export type AssetNameFailure = 'empty' | 'too-long'

export function checkAssetName(name: string): AssetNameFailure | null {
  const trimmed = name.trim()

  if (trimmed.length === 0) return 'empty'
  // By code point, as the bound is meant: a name of emoji is as long as it looks, not twice.
  if ([...trimmed].length > ASSET_NAME_MAX_LENGTH) return 'too-long'

  return null
}
