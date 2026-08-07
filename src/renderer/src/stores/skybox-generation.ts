import { isLocalPicture, type Asset } from '@shared/domain/asset'
import { isFinished, type Job } from '@shared/domain/job'
import type { SkyboxContent } from '@shared/domain/skybox'
import { applyGeneration } from '@/engines/skybox/commands'
import { generationOf } from '@/helpers/generation'
import { useAssets } from './assets'
import { activeIdOfKind, useDocuments } from './documents'
import { useJobs } from './jobs'
import { useSkyboxes } from './skyboxes'

/**
 * Which sky each running generation was launched for.
 *
 * Session state, and deliberately not persisted: a job outlives neither the window that
 * submitted it nor the tab it was meant for, and a claim restored tomorrow would drop a
 * picture into a document whose author has long moved on.
 */
const claims = new Map<string, string>()

/**
 * Takes note of the sky a generation is being launched from, and hands back what claims the
 * job once its id is known.
 *
 * In two halves because the two moments are: the target has to be read at the click, while a
 * job id only exists after `POST /generate` has answered — and a user who switches tabs during
 * that round trip would otherwise have the result land wherever they went. The caller learns
 * nothing of what was captured, which is what keeps the generator free of any one workspace.
 */
export function claimOnSubmit(): (job: Job | null) => void {
  const documentId = activeIdOfKind(useDocuments.getState(), 'skybox')

  return job => {
    if (job && documentId) claims.set(job.id, documentId)
  }
}

/** What a generation is worth remembering of itself, minus the parameters a sky has no use for. */
function provenanceOf(asset: Asset): SkyboxContent['generation'] {
  const { jobs, bodies } = useJobs.getState()
  const generation = generationOf(asset, jobs, bodies)
  if (!generation) return undefined

  const { modelId, modelLabel, prompt, seed } = generation
  return { modelId, modelLabel, prompt, seed }
}

/**
 * Hangs what the finished jobs produced in the skies that asked for them.
 *
 * The catalogue is read once for the whole batch rather than once per claim: `assets.search` is
 * a synchronous SQLite query in the main process, and three jobs settling inside the same
 * couple of hundred milliseconds would otherwise fire three identical reads at it.
 *
 * It is read at all — rather than waited on — because `useJobs` coalesces its own refresh over
 * that same window, so the rows are not in the list yet at the moment a job reports success.
 *
 * The job hands back Scenario's own asset ids; what a document stores is the id of the row the
 * collector wrote, so the two are joined on `jobId` — the only identifier both sides share.
 */
async function hang(settled: ReadonlyMap<string, string>): Promise<void> {
  await useAssets.getState().refresh()

  const { items } = useAssets.getState()
  const { documents } = useDocuments.getState()

  for (const [jobId, documentId] of settled) {
    // A generation can answer several pictures; the first that decodes is the sky. Anything
    // else it produced stays on the shelf rather than being guessed at.
    const asset = items.find(candidate => candidate.jobId === jobId && isLocalPicture(candidate))
    // The tab may have been closed while the job ran: writing into it would resurrect a
    // document nothing shows, with a history nobody can reach.
    if (!asset || !documents[documentId]) continue

    useSkyboxes
      .getState()
      .runCommand(documentId, applyGeneration({ assetId: asset.id }, provenanceOf(asset)))
  }
}

/** Every claim whose job has stopped running, settled and let go of. */
function settle(jobs: readonly Job[]): void {
  if (claims.size === 0) return

  const succeeded = new Map<string, string>()
  for (const job of jobs) {
    const documentId = claims.get(job.id)
    if (documentId === undefined || !isFinished(job.status)) continue

    // Dropped whatever the outcome: a failed or cancelled job has nothing to hang, and a claim
    // kept for it would outlive the window.
    claims.delete(job.id)
    if (job.status === 'succeeded') succeeded.set(job.id, documentId)
  }

  if (succeeded.size > 0) void hang(succeeded)
}

/**
 * Follows the job list and lands what the skybox workspace asked for. Returns the unsubscribe,
 * like the stores that connect to the main process — see `Application`.
 */
export function connectSkyboxGeneration(): () => void {
  const stop = useJobs.subscribe(state => settle(state.jobs))
  return () => {
    stop()
    // Nothing can land once nothing listens, so the claims go with the subscription rather
    // than outliving it — which is also what lets a test reset by disconnecting.
    claims.clear()
  }
}
