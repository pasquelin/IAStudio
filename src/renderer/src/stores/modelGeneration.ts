import { createGenerationLanding } from './generationLanding'
import { addModelTo } from './scenes'

/** A 3D generation comes back into the scene it was launched from. See `generationLanding`. */
const landing = createGenerationLanding({
  kind: 'scene',
  accepts: asset => asset.type === 'mesh',
  takes: 'first',
  land: (documentId, asset) => void addModelTo(documentId, asset),
})

export const claimModelOnSubmit = landing.claimOnSubmit
export const connectModelGeneration = landing.connect
