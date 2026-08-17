import type { Asset } from '@shared/domain/asset'
import type { DocumentKind } from '@shared/domain/document'
import { isFinished, type Job } from '@shared/domain/job'
import { useAssets } from './assets'
import { activeIdOfKind, useDocuments } from './documents'
import { useJobs } from './jobs'

/** What one workspace needs said about where its generations land. Everything else is shared. */
export type GenerationLanding = {
  kind: DocumentKind
  /** Which of a generation's outputs this workspace can take. The rest stays on the shelf. */
  accepts: (asset: Asset) => boolean
  /**
   * How much of a batch it keeps, and the only thing the three workspaces ever differed on: a
   * sky is one sky and a scene one model, while a canvas gives every picture a layer of its own
   * — so `every` leaves the last one rendered armed.
   */
  takes: 'first' | 'every'
  land: (documentId: string, asset: Asset) => void
}

export type LandingChannel = {
  /**
   * Takes note of the document a generation is being launched from, and hands back what claims
   * the job once its id is known.
   *
   * In two halves because the two moments are: the target has to be read at the click, while a
   * job id only exists after `POST /generate` has answered — and a user who switches tabs during
   * that round trip would otherwise have the result land wherever they went.
   */
  claimOnSubmit: () => (job: Job | null) => void
  /** Follows the job list and lands what this workspace asked for. Returns the unsubscribe. */
  connect: () => () => void
}

/**
 * The machinery every workspace shares for putting a finished generation where it was asked
 * for: a claim per running job, settled when it stops running.
 *
 * Written once because the sky, the scene and the canvas need the same thing and differ by four
 * values. The canvas proved the point the hard way: it kept its own copy of this for a while,
 * ninety lines against fifteen, carrying the subtleties (capture at the click, drop the claim
 * whatever the outcome, read the catalogue rather than wait on it) without the tests that guard
 * them here.
 */
export function createGenerationLanding({
  kind,
  accepts,
  takes,
  land,
}: GenerationLanding): LandingChannel {
  /**
   * Which document each running generation was launched for.
   *
   * Session state, and deliberately not persisted: a job outlives neither the window that
   * submitted it nor the tab it was meant for, and a claim restored tomorrow would drop a result
   * into a document whose author has long moved on.
   */
  const claims = new Map<string, string>()

  /**
   * The catalogue is read rather than waited on: `useAssets` coalesces its refresh over a couple
   * of hundred milliseconds so that a burst of finishing ingests does not freeze every window,
   * and the rows are therefore not in the list yet at the moment a job reports success.
   *
   * The job hands back Scenario's own asset ids; what a document stores is the id of the row the
   * collector wrote, so the two are joined on `jobId` — the only identifier both sides share.
   */
  const settleInto = async (settled: ReadonlyMap<string, string>): Promise<void> => {
    await useAssets.getState().refresh()

    const { items } = useAssets.getState()
    const { documents } = useDocuments.getState()

    for (const [jobId, documentId] of settled) {
      // The tab may have been closed while the job ran: writing into it would resurrect a
      // document nothing shows, with a history nobody can reach.
      if (!documents[documentId]) continue

      // In catalogue order, which is the order they were rendered. Stopped at the first match
      // when that is all this workspace takes: `items` is the project's whole catalogue.
      for (const asset of items) {
        if (asset.jobId !== jobId || !accepts(asset)) continue

        land(documentId, asset)
        if (takes === 'first') break
      }
    }
  }

  const settle = (jobs: readonly Job[]): void => {
    if (claims.size === 0) return

    const succeeded = new Map<string, string>()
    for (const job of jobs) {
      const documentId = claims.get(job.id)
      if (documentId === undefined || !isFinished(job.status)) continue

      // Dropped whatever the outcome: a failed or cancelled job has nothing to land, and a claim
      // kept for it would outlive the window.
      claims.delete(job.id)
      if (job.status === 'succeeded') succeeded.set(job.id, documentId)
    }

    if (succeeded.size > 0) void settleInto(succeeded)
  }

  return {
    claimOnSubmit: () => {
      const documentId = activeIdOfKind(useDocuments.getState(), kind)

      return job => {
        if (job && documentId) claims.set(job.id, documentId)
      }
    },

    connect: () => {
      const stop = useJobs.subscribe(state => settle(state.jobs))
      return () => {
        stop()
        // Nothing can land once nothing listens, so the claims go with the subscription rather
        // than outliving it — which is also what lets a test reset by disconnecting.
        claims.clear()
      }
    },
  }
}
