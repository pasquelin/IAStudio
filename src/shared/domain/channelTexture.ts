import type { Asset } from './asset'
import type { PbrChannel } from './material'

/** A picture extraction gave a channel to — the only kind a material can be built out of. */
export type ChannelTexture = Asset & { map: PbrChannel }

/** A picture that says WHICH channel it is. A guard, so the caller keeps the narrowing. */
export function hasChannel(asset: Asset): asset is ChannelTexture {
  return asset.map !== undefined
}
