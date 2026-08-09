import type Scenario from '@scenario-labs/sdk'
import type { JobRunner, RemoteJob } from './job-manager'
import { asUrgent } from './rate-limiter'

/** One node of a workflow job, as `metadata.flow` reports it — see `outputsOf`. */
type RemoteFlowNode = { assets?: readonly { assetId?: string }[] }

/** What either endpoint hands back, before the studio has narrowed it. */
type RemoteJobPayload = {
  jobId: string
  status: string
  /** `workflow` for an App, `custom` for a generation — read by `costOf`, and by nothing else. */
  jobType?: string
  progress?: number
  cost?: number
  /** Declared by `workflows.run` and by `jobs.retrieve` alike — see `normalized`. */
  billing?: { cuCost?: number }
  metadata?: { assetIds?: readonly string[]; flow?: readonly RemoteFlowNode[] }
}

/**
 * The assets a job leaves behind, whichever endpoint ran it.
 *
 * A generation names them in `metadata.assetIds`. A workflow job carries `metadata.flow`, one
 * entry per node — and the API says only the last nodes contribute to the job's own outputs
 * unless a node asks otherwise. So `assetIds` is read first and the flow only when it says
 * nothing: flattening both would import every intermediate picture of a pipeline as a result.
 *
 * Normalized here rather than in the job manager, which has no business knowing that one kind of
 * job reports node by node: this file is the one that speaks SDK.
 */
export function outputsOf(payload: RemoteJobPayload): string[] {
  const named = payload.metadata?.assetIds ?? []
  const produced =
    named.length > 0
      ? named
      : (payload.metadata?.flow ?? []).flatMap(node =>
          (node.assets ?? []).map(asset => asset.assetId),
        )

  // Deduplicated whichever list it came from: a node listed twice — a loop body, a node whose
  // outputs are also final — would otherwise have the collector fetch and file the same asset
  // more than once, and nothing says the other list never repeats one either.
  return [...new Set(produced.filter(assetId => assetId !== undefined))]
}

/**
 * What the job cost, from whichever of the two places the API says it.
 *
 * `creativeUnitsCost` sits beside a submitted generation; `billing.cuCost` sits on the job, so a
 * resumed one can still show what it cost. A workflow job never bills itself — each node does,
 * and `cuCost: 0` on the parent means unbilled, not free (observed 9 August 2026: parent 0, node
 * 12). A generation that really is free says so on its own job.
 *
 * A figure that cannot be drawn is no figure: the job manager only emits on change, and a NaN
 * would defeat that guard on every poll — the very trap `jobProgressOf` was sealed against.
 */
const costOf = (payload: RemoteJobPayload): number | undefined => {
  const billed = payload.billing?.cuCost
  const spent =
    payload.cost ?? (payload.jobType === 'workflow' && billed === 0 ? undefined : billed)

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
    // A generation prices the REQUEST, beside the job and not inside it; a workflow answers
    // `{ job, workflow }` and says nothing there. Both may carry `billing.cuCost` on the job —
    // see `costOf`, which is what makes the two paths one.
    submit: async (target, body): Promise<RemoteJob> => {
      if (target.kind === 'workflow') {
        const { job } = await client.workflows.run(target.id, { body })
        return normalized(job)
      }

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
