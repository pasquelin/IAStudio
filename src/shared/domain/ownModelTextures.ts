import type { Asset } from './asset'
import type { ModelRef, TextureRef, TextureSlot } from './scene'
import { slotForChannel, type PbrChannel } from './texture'

/** A picture that says WHICH channel it is. A guard, so the caller keeps the narrowing. */
export function hasChannel(asset: Asset): asset is ChannelTexture {
  return asset.map !== undefined
}

/** A picture extraction gave a channel to — the only kind a material can be built out of. */
export type ChannelTexture = Asset & { map: PbrChannel }

/**
 * The slots a model's OWN pictures dress — the ones extraction took out of its file on import.
 *
 * `undefined` rather than a set whenever the answer would be a guess: no picture claims a slot, or
 * two claim the same one — a `.glb` of two materials yields two base colours, and `ModelRef` has
 * no name to hang a per-material override on.
 */
export function ownModelTextures(derived: readonly Asset[]): ModelRef['textures'] {
  const slots: Partial<Record<TextureSlot, TextureRef>> = {}

  for (const picture of derived) {
    if (!hasChannel(picture)) continue
    const slot = slotForChannel(picture.map)
    if (!slot) continue
    if (slots[slot]) return undefined
    slots[slot] = { assetId: picture.id }
  }

  return Object.keys(slots).length > 0 ? slots : undefined
}

/**
 * What a node actually wears: the slots it names, over the pictures its file shed.
 *
 * HERE rather than in the engine, which only applies it — it is what a model node MEANS. It is
 * also why the inspector no longer offers « use the model's pictures »: that button wrote them
 * into the node by hand, the other way round, so it replaced slots somebody had chosen.
 */
export function effectiveModelTextures(
  named: ModelRef['textures'],
  own: ModelRef['textures'],
): ModelRef['textures'] {
  // A slot somebody filled is a DECISION; a picture the file shed is only what nobody chose.
  return own ? { ...own, ...named } : named
}
