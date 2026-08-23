import { ASSET_TYPES } from '@shared/domain/asset'
import { createGenerationLanding } from './generationLanding'
import { addAssetToSequence, sequenceTakes } from './sequences'

/**
 * A video generation comes back into the montage it was launched from. See `generationLanding`,
 * which holds the machinery every workspace shares.
 *
 * `every`, like the canvas: a montage lays each clip on a track of its own, and a batch that
 * lands one clip would leave the rest on the shelf with nothing saying so.
 */
const landing = createGenerationLanding({
  kind: 'sequence',
  // Which tracks are free is a property of the montage, not of the asset — the same guard the
  // drop already asks, so a generation cannot land where a drag would have been refused.
  accepts: asset => ASSET_TYPES.includes(asset.type),
  types: ASSET_TYPES,
  takes: 'every',
  scope: 'sequence.import',
  land: (documentId, asset) => {
    if (sequenceTakes(documentId, asset)) addAssetToSequence(documentId, asset)
  },
})

export const claimSequenceOnSubmit = landing.claimOnSubmit
export const connectSequenceGeneration = landing.connect
