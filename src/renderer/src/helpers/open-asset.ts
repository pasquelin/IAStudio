import type { Asset } from '@shared/domain/asset'
import { reportFailure } from '@/services/diagnostics'
import { defaultIntent } from './asset-intents'

/**
 * What double-clicking an asset does — the cascade itself is `ASSET_INTENTS`.
 *
 * A refusal is said out loud. The same double-click worked over one tab and did nothing at all
 * over another, without a word either way, which is what made the gesture untrustworthy: the
 * right-click menu lists the destinations, but only for whoever thinks to open it.
 */
export function openAsset(asset: Asset): Promise<void> {
  const intent = defaultIntent(asset)
  if (!intent) {
    reportFailure('assets.open', asset.name, new Error('no destination'))
    return Promise.resolve()
  }

  return intent.run(asset)
}
