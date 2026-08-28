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

export const claimScriptOnSubmit = claims.claimOnSubmit

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
