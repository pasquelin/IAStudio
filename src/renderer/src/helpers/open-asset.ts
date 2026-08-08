import type { Asset } from '@shared/domain/asset'
import { defaultIntent } from './asset-intents'

/**
 * What double-clicking an asset does, which depends on what is open rather than on what was
 * clicked: a take goes onto the montage when a sequence is in front, into the editor when an
 * audio tab is, a picture becomes the sky when a skybox tab is, and a layer of its own when an
 * image tab is.
 *
 * The cascade itself now lives in `ASSET_INTENTS`, in the order it used to be written as `if`s.
 * The reason it moved: a menu can only offer what it can enumerate, and this used to be the
 * only place that knew where an asset could go — so it was the only gesture that could send one.
 */
export function openAsset(asset: Asset): void {
  defaultIntent(asset)?.run(asset)
}
