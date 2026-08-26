// SPDX-License-Identifier: MIT

import type { AssetPort } from '../ports/assetPort'

/**
 * The studio serves an asset on a protocol of its own, and the way to spell that URL belongs to
 * the studio — which is not MIT. So it arrives as a parameter, and what stays here is the refusal.
 */
export function createHostedAssets(urlForAsset: (id: string) => string): AssetPort {
  return { urlOf: ref => (ref.kind === 'asset' ? urlForAsset(ref.id) : null) }
}
