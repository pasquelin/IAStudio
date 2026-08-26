import type { ModelRef } from '@shared/domain/scene'
import { ownModelTextures } from '@shared/domain/ownModelTextures'
import { orElse } from '@shared/promises'
import { getBridge } from '@/services/bridge'

/**
 * A model's own pictures, asked of the catalogue — what a scene takes as a port (`ownTextures`).
 *
 * Never rejects: this fills slots nobody has chosen, so a catalogue that will not answer leaves
 * the model wearing the maps its own file carries rather than taking the node down.
 */
export async function askOwnModelTextures(meshAssetId: string): Promise<ModelRef['textures']> {
  return ownModelTextures(
    await orElse(getBridge()?.assets.search({ derivedFrom: meshAssetId, type: 'texture' }), []),
  )
}
