import type { Asset } from '@shared/domain/asset'
import { defaultIntent } from './asset-intents'

/** What double-clicking an asset does — the cascade itself is `ASSET_INTENTS`. */
export function openAsset(asset: Asset): void {
  defaultIntent(asset)?.run(asset)
}
