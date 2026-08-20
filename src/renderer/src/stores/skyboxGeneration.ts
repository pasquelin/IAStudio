import { isLocalPicture, PICTURES } from '@shared/domain/asset'
import { createGenerationLanding } from './generationLanding'
import { setSkyboxSource } from './skyboxes'

/**
 * A sky generation comes back into the skybox it was launched from. See `generationLanding`,
 * which holds the machinery this and the 3D workspace share.
 */
const landing = createGenerationLanding({
  kind: 'skybox',
  // A generation can answer several pictures; the first that decodes is the sky.
  accepts: isLocalPicture,
  types: PICTURES,
  takes: 'first',
  land: setSkyboxSource,
})

export const claimSkyboxOnSubmit = landing.claimOnSubmit
export const connectSkyboxGeneration = landing.connect
