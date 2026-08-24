import type { DocumentKind } from '@shared/domain/document'
import type { Job } from '@shared/domain/job'
import { claimAudioOnSubmit } from './audioGeneration'
import { claimImageOnSubmit } from './imageGeneration'
import { claimModelOnSubmit } from './modelGeneration'
import { claimSequenceOnSubmit } from './sequenceGeneration'
import { claimSkyboxOnSubmit } from './skyboxGeneration'
import { claimTextureOnSubmit } from './textureGeneration'

/**
 * 🛑 Every workspace that has somewhere to put a result. A kind missing here is a generation that
 * lands nowhere — the result reaches the shelf, no document at all, and nothing says so.
 *
 * `Record<DocumentKind, …>` so the compiler asks for the seventh workspace's line rather than a
 * test noticing it later. The generator serves all of them and knows none.
 */
const CLAIMS: Record<DocumentKind, () => (job: Job | null) => void> = {
  skybox: claimSkyboxOnSubmit,
  image: claimImageOnSubmit,
  scene: claimModelOnSubmit,
  sequence: claimSequenceOnSubmit,
  audio: claimAudioOnSubmit,
  texture: claimTextureOnSubmit,
}

/**
 * Every workspace claimed in one call. Both halves are fanned out together, or a claim taken by
 * one space and settled by another would drop the result in the wrong tab.
 */
export function claimOnSubmit(): (job: Job | null) => void {
  const claims = Object.values(CLAIMS).map(claim => claim())

  return job => {
    for (const claim of claims) claim(job)
  }
}
