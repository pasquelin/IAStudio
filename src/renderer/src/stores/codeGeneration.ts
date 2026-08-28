import { partsOfRole, type AiRoleId } from '@shared/domain/aiRole'
import type { Job } from '@shared/domain/job'
import type { LandingTarget } from '@shared/domain/landingTarget'
import { reportNotice } from '@/services/diagnostics'
import { createLandingClaims, landingInto } from './generationLanding'
import { useJobs } from './jobs'

/**
 * Through `import()`, for the reason `materialGeneration` gives: the opening chunk's reach into
 * the editors is held at two files by `eager-graph.test.ts`, and this runs when a generation
 * comes back.
 */
async function putScript(documentId: string | null, source: string): Promise<void> {
  const { landScript } = await import('@/spaces/code/landScript')
  // AFTER the import, which is a round trip of its own: `landingInto` says why.
  if (await landScript(landingInto(documentId), source)) return

  // 🛑 Said, never dropped: the generation was PAID for, and the one thing that refuses it is an
  // editor holding unsaved work — which `⌘Z` cannot undo either.
  reportNotice(
    'code.land',
    'the editor holds unsaved changes: the generated script was not written',
  )
}

/**
 * A generated script comes back into the editor it was launched from, or into a tab of its own.
 *
 * 🛑 NOT `createGenerationLanding`, and the difference is what comes back: every other space
 * lands a ROW OF THE SHELF, joined to its job through the catalogue. A script is text on the job
 * itself — there is no asset, no catalogue read and no shelf — so only the claims are shared.
 */
const claims = createLandingClaims('script')

/**
 * The landing chunk, fetched while the model is still writing: 1 251 ms cold against 0,056 ms
 * once a two-second generation has run, measured. A failure changes nothing — `putScript` retries.
 */
async function warmLanding(): Promise<void> {
  try {
    await import('@/spaces/code/landScript')
  } catch {
    // Said by `putScript`, which is where a person can act on it.
  }
}

export const claimScriptOnSubmit = (
  into?: LandingTarget,
  role: AiRoleId | null = null,
): ((job: Job | null) => void) => {
  // 🛑 Gated on the FAMILY: a claim is fanned out to all seven spaces, and this chunk pulls
  // `app/newDocument` with the scene stack behind it.
  if (role !== null && partsOfRole(role)?.family === 'code') void warmLanding()
  return claims.claimOnSubmit(into)
}

export function connectCodeGeneration(): () => void {
  return claims.connect(settled => {
    const jobs = useJobs.getState().jobs

    for (const [jobId, into] of settled) {
      // A job with no text is every other generation of the studio: the claims are fanned out to
      // all seven spaces at once, and six of them land an asset.
      const written = jobs.find(job => job.id === jobId)?.text
      if (written) void putScript(into, written)
    }
  })
}
