import { isLocalPicture, PICTURES, type Asset } from '@shared/domain/asset'
import { createGenerationLanding } from './generationLanding'

async function placeChannel(documentId: string, asset: Asset): Promise<void> {
  const { placeMaterialChannel } = await import('@/spaces/materials/placeChannel')
  placeMaterialChannel(documentId, asset)
}

/**
 * A texture generation comes back into the material it was launched from, on its base colour.
 *
 * `first`, and the channel is not read from the generation: one run answers one picture of a
 * surface, and which channel it is only a converter job can say. A batch landing on every
 * channel would overwrite a roughness map with an albedo.
 */
const landing = createGenerationLanding({
  kind: 'material',
  accepts: isLocalPicture,
  types: PICTURES,
  takes: 'first',
  scope: 'material.channel',
  // Through `import()`, for the reason `audioGeneration` gives: the opening chunk's reach into
  // the editors is held at two files, and this runs when a generation comes back.
  land: (documentId, asset) => void placeChannel(documentId, asset),
})

export const claimMaterialOnSubmit = landing.claimOnSubmit
export const connectMaterialGeneration = landing.connect
