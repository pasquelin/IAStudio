import type Scenario from '@scenario-labs/sdk'
import type { JobRunner, RemoteJob } from './job-manager'
import { asUrgent } from './rate-limiter'

/** What the endpoint hands back, before the studio has narrowed it. */
type RemoteJobPayload = {
  jobId: string
  status: string
  progress?: number
  cost?: number
  /** Declared by `jobs.retrieve` as well as by a submission — see `normalized`. */
  billing?: { cuCost?: number }
  metadata?: { assetIds?: readonly string[] }
}

/**
 * The assets a job leaves behind.
 *
 * Deduplicated as an assurance rather than as a correction: no observed payload repeats an id,
 * and nothing says the API never will. What a repeat costs is measured — the collector fetches
 * and files the same remote asset twice, and the activity count overstates — so the `Set` is
 * cheaper than the doubt.
 *
 * Read here rather than in the job manager: this file is the one that speaks SDK.
 */
export function outputsOf(payload: RemoteJobPayload): string[] {
  return [...new Set(payload.metadata?.assetIds ?? [])]
}

/**
 * What the job cost, from whichever of the two places the API says it.
 *
 * `creativeUnitsCost` sits beside a submitted generation; `billing.cuCost` sits on the job, so a
 * resumed one can still show what it cost.
 *
 * A figure that cannot be drawn is no figure: the job manager only emits on change, and a NaN
 * would defeat that guard on every poll — the very trap `jobProgressOf` was sealed against.
 */
const costOf = (payload: RemoteJobPayload): number | undefined => {
  const spent = payload.cost ?? payload.billing?.cuCost

  return spent !== undefined && Number.isFinite(spent) ? spent : undefined
}

const normalized = (payload: RemoteJobPayload): RemoteJob => {
  const cost = costOf(payload)

  return {
    jobId: payload.jobId,
    status: payload.status,
    ...(payload.progress === undefined ? {} : { progress: payload.progress }),
    ...(cost === undefined ? {} : { cost }),
    assetIds: outputsOf(payload),
  }
}

/**
 * Binds the job manager's narrow runner to the real SDK. The client is captured, not resolved
 * per call: a job is submitted, polled and cancelled on one account — see `JobAccount`.
 */
export function runnerOf(client: Scenario): JobRunner {
  return {
    // A generation prices the REQUEST, beside the job and not inside it; the job may also carry
    // `billing.cuCost` — see `costOf`.
    submit: async (target, body): Promise<RemoteJob> => {
      const { job, creativeUnitsCost } = await client.generate.runModel(target.id, { body })
      return normalized(creativeUnitsCost === undefined ? job : { ...job, cost: creativeUnitsCost })
    },

    poll: async jobId => normalized((await client.jobs.retrieve(jobId)).job),

    // Ahead of the queue: this is the one call whose purpose is to stop spending, and behind a
    // saturated window it would be held for as long as the generation it is meant to stop.
    cancel: async jobId => {
      await asUrgent(() => client.jobs.triggerAction(jobId, { action: 'cancel' }))
    },
  }
}
