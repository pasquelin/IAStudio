import { DOCUMENT_KINDS, type DocumentKind } from '@shared/domain/document'
import type { Job } from '@shared/domain/job'
import { activeIdOfKind, useDocuments } from './documents'
import type { LandingTarget } from './generationLanding'
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
const CLAIMS: Record<DocumentKind, (into?: LandingTarget) => (job: Job | null) => void> = {
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
export function claimOnSubmit(into?: LandingTarget): (job: Job | null) => void {
  const claims = Object.values(CLAIMS).map(claim => claim(into))

  return job => {
    for (const claim of claims) claim(job)
  }
}

/**
 * Whether a result would have somewhere to go other than a tab of its own — the one condition
 * the question is worth asking under. With nothing open there is nothing to choose between.
 *
 * Read across every kind rather than for the one this generation serves: the generator serves
 * all six and knows none, which is the whole point of `CLAIMS` above.
 */
export function documentAwaits(): boolean {
  const state = useDocuments.getState()
  return DOCUMENT_KINDS.some(kind => activeIdOfKind(state, kind) !== null)
}
