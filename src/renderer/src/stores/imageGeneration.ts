import { isLocalPicture, PICTURES } from '@shared/domain/asset'
import { placeAsset } from '@/features/image/placeAsset'
import { createGenerationLanding } from './generationLanding'

/**
 * An image generation comes back into the canvas it was launched from — the whole batch, unlike
 * the sky and the scene. See `generationLanding`, which documents what `takes` means.
 */
const landing = createGenerationLanding({
  kind: 'image',
  accepts: isLocalPicture,
  types: PICTURES,
  takes: 'every',
  scope: 'canvas.place',
  land: placeAsset,
})

export const claimImageOnSubmit = landing.claimOnSubmit
export const connectImageGeneration = landing.connect
