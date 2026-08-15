import type { Job } from '@shared/domain/job'
import { claimImageOnSubmit } from './image-generation'
import { claimModelOnSubmit } from './model-generation'
import { claimSkyboxOnSubmit } from './skybox-generation'

/**
 * Every workspace that has somewhere to put a result, claimed in one call.
 *
 * The generator serves all of them and knows none: it asks here at the click, and hands the job
 * back when the id arrives. Both halves are fanned out together, or a claim taken by one space
 * and settled by another would drop the result in the wrong tab. Only one claim can be live at a
 * time — a claim reads the document in front, and there is one — so the list costs nothing to
 * hold and everything to forget: a workspace added without a line here is a generation that
 * lands nowhere.
 */
export function claimOnSubmit(): (job: Job | null) => void {
  const claims = [claimSkyboxOnSubmit(), claimImageOnSubmit(), claimModelOnSubmit()]

  return job => {
    for (const claim of claims) claim(job)
  }
}
