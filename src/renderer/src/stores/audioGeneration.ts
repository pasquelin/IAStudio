import { createGenerationLanding } from './generationLanding'

/**
 * An audio generation comes back into the editor it was launched from. `first`, unlike the
 * canvas: the editor holds ONE take, and a second would lay a new block over the bytes the
 * first named — same take, new id, and every setting on the old one orphaned.
 */
const landing = createGenerationLanding({
  kind: 'audio',
  accepts: asset => asset.type === 'audio',
  types: ['audio'],
  takes: 'first',
  scope: 'sequence.import',
  // Through `import()`, like the measuring gestures of `assetIntents`: `eager-graph.test.ts`
  // holds the opening chunk's reach into the editors, and nothing here runs before a generation
  // this workspace launched comes back.
  land: (documentId, asset) => {
    void import('@/spaces/audio/loadTake').then(({ loadTake }) => loadTake(documentId, asset))
  },
})

export const claimAudioOnSubmit = landing.claimOnSubmit
export const connectAudioGeneration = landing.connect
