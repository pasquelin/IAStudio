import { isLocalPicture } from '@shared/domain/asset'
import { placeAsset } from '@/spaces/image/place-asset'
import { createGenerationLanding } from './generation-landing'

/**
 * An image generation comes back into the canvas it was launched from — the whole batch, unlike
 * the sky and the scene. See `generation-landing`, which documents what `takes` means.
 */
const landing = createGenerationLanding({
  kind: 'image',
  accepts: isLocalPicture,
  takes: 'every',
  land: placeAsset,
})

export const claimImageOnSubmit = landing.claimOnSubmit
export const connectImageGeneration = landing.connect
