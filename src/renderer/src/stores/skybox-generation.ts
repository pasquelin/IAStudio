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
 * Remembers that the generation just submitted was meant for the sky in front. Nothing happens
 * when the document in front is of another kind — the generator is one panel for every
 * workspace, and only this one has somewhere for the result to land by itself.
 */
export function claimGeneration(jobId: string): void {
  const documentId = activeIdOfKind(useDocuments.getState(), 'skybox')
  if (documentId) claims.set(jobId, documentId)
}

/** Drops every claim. The seam the tests reset through — nothing else has business here. */
export function forgetGenerations(): void {
  claims.clear()
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
 * Hangs what a finished job produced in the sky that asked for it.
 *
 * The catalogue is read again rather than waited on: `useJobs` coalesces its refresh over a
 * couple of hundred milliseconds so that forty finishing ingests do not freeze the window, and
 * the asset is not in the list yet at the moment the job reports success.
 *
 * The job hands back Scenario's own asset ids; what the document stores is the id of the row
 * the collector wrote, so the two are joined on `jobId` — the only identifier both sides share.
 */
async function hang(job: Job, documentId: string): Promise<void> {
  await useAssets.getState().refresh()

  // A generation can answer several pictures; the first that decodes is the sky. Anything else
  // it produced stays on the shelf rather than being guessed at.
  const asset = useAssets
    .getState()
    .items.find(candidate => candidate.jobId === job.id && isLocalPicture(candidate))
  if (!asset) return

  // The tab may have been closed while the job ran: writing into it would resurrect a document
  // nothing shows, with a history nobody can reach.
  if (!useDocuments.getState().documents[documentId]) return

  useSkyboxes
    .getState()
    .runCommand(documentId, applyGeneration({ assetId: asset.id }, provenanceOf(asset)))
}

/** Every claim whose job has stopped running, settled and let go of. */
function settle(jobs: readonly Job[]): void {
  for (const [jobId, documentId] of [...claims]) {
    const job = jobs.find(candidate => candidate.id === jobId)
    if (!job || !isFinished(job.status)) continue

    // Dropped whatever the outcome: a failed or cancelled job has nothing to hang, and a claim
    // kept for it would outlive the window.
    claims.delete(jobId)
    if (job.status === 'succeeded') void hang(job, documentId)
  }
}

/**
 * Follows the job list and lands what the skybox workspace asked for. Returns the unsubscribe,
 * like the stores that connect to the main process — see `Application`.
 */
export function connectSkyboxGeneration(): () => void {
  return useJobs.subscribe(state => settle(state.jobs))
}
