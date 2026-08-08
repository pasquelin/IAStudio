import type { Job } from '@shared/domain/job'
import { claimOnSubmit as claimImage } from './image-generation'
import { claimOnSubmit as claimSkybox } from './skybox-generation'

/**
 * The one thing the generator calls when it submits. Each workspace that can take a result
 * claims for itself, and only the one whose tab is in front finds a target — so the panel stays
 * ignorant of every space, which is what lets it serve all of them.
 *
 * Asked at the click, settled when the job id arrives: both halves are fanned out together, or
 * a claim taken by one space and settled by another would drop the result in the wrong tab.
 */
export function claimOnSubmit(): (job: Job | null) => void {
  const claims = [claimSkybox(), claimImage()]

  return job => {
    for (const claim of claims) claim(job)
  }
}
