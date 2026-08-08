import { isLocalPicture } from '@shared/domain/asset'
import { createGenerationLanding } from './generation-landing'
import { setSkyboxSource } from './skyboxes'

/**
 * A sky generation comes back into the skybox it was launched from. See `generation-landing`,
 * which holds the machinery this and the 3D workspace share.
 */
const landing = createGenerationLanding({
  kind: 'skybox',
  // A generation can answer several pictures; the first that decodes is the sky.
  accepts: isLocalPicture,
  land: setSkyboxSource,
})

export const claimSkyboxOnSubmit = landing.claimOnSubmit
export const connectSkyboxGeneration = landing.connect
