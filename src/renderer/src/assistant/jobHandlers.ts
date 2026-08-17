import type { ActionOutcome, ActionRefusal } from '@shared/domain/assistant'
import { isFinished, type Job } from '@shared/domain/job'
import { DEFAULT_USAGE_PERIOD, USAGE_PERIODS, type UsagePeriod } from '@shared/domain/usage'
import { getBridge } from '@/services/bridge'
import { useJobs } from '@/stores/jobs'
import type { ActionHandlers } from './actionHandler'
import { numberOf, oneOf, recordOf, textOf } from './actionInputs'

/**
 * A generation, from what a model accepts to what came out of it.
 *
 * The jobs read here are the studio's own replica, kept up to date by the progress events the
 * `JobManager` broadcasts. Nothing in this file polls the API — that is the manager's, and one
 * poller is the invariant.
 */

const refused = (refusal: ActionRefusal): ActionOutcome => ({ ok: false, refusal })

/** Every job carries its whole self across, `assetIds` above all: it is what generating was for. */
const DEFAULT_WAIT_MS = 60_000

function jobOf(jobId: string): Job | null {
  return useJobs.getState().jobs.find(job => job.id === jobId) ?? null
}

function readJob(input: Record<string, unknown>): ActionOutcome {
  const jobId = textOf(input, 'jobId')
  const job = jobId === null ? null : jobOf(jobId)
  return job ? { ok: true, data: job } : refused('badInput')
}

/**
 * Waits for a job to reach a terminal state, on the store rather than on the API.
 *
 * A timeout answers the job as it stands rather than a refusal: "still running after a minute"
 * is an answer a client can act on, and a refusal would lose the progress along with it.
 */
function waitForJob(input: Record<string, unknown>): Promise<ActionOutcome> {
  const jobId = textOf(input, 'jobId')
  const job = jobId === null ? null : jobOf(jobId)
  if (jobId === null || !job) return Promise.resolve(refused('badInput'))
  if (isFinished(job.status)) return Promise.resolve({ ok: true, data: job })

  return new Promise(resolve => {
    const settle = (answer: Job | null): void => {
      stop()
      clearTimeout(timer)
      resolve(answer ? { ok: true, data: answer } : refused('badInput'))
    }

    const stop = useJobs.subscribe(state => {
      const seen = state.jobs.find(one => one.id === jobId)
      // Gone from the list is not a failure: a project closing takes its jobs with it, and the
      // last state this saw is more useful to answer than a refusal.
      if (!seen) settle(job)
      else if (isFinished(seen.status)) settle(seen)
    })

    const timer = setTimeout(
      () => settle(jobOf(jobId)),
      numberOf(input, 'timeoutMs') ?? DEFAULT_WAIT_MS,
    )
  })
}

async function cancelJob(input: Record<string, unknown>): Promise<ActionOutcome> {
  const jobId = textOf(input, 'jobId')
  if (jobId === null || !jobOf(jobId)) return refused('badInput')

  await useJobs.getState().cancel(jobId)
  return { ok: true }
}

async function modelSchema(input: Record<string, unknown>): Promise<ActionOutcome> {
  const bridge = getBridge()
  const modelId = textOf(input, 'modelId')
  if (!bridge) return refused('noBridge')
  if (modelId === null) return refused('badInput')

  try {
    return { ok: true, data: await bridge.scenario.describeModel(modelId) }
  } catch {
    // A model id nothing answers for. Refused rather than thrown: the client asked a well-formed
    // question about a model that is not there.
    return refused('badInput')
  }
}

async function estimateCost(input: Record<string, unknown>): Promise<ActionOutcome> {
  const bridge = getBridge()
  const modelId = textOf(input, 'modelId')
  const parameters = recordOf(input, 'parameters')
  if (!bridge) return refused('noBridge')
  if (modelId === null || !parameters) return refused('badInput')

  try {
    // `null` is a legitimate answer and travels as one: the API declines to price some models,
    // and a figure invented to fill the field would be worse than admitting there is none.
    return { ok: true, data: await bridge.scenario.estimateCost({ id: modelId }, parameters) }
  } catch {
    return refused('badInput')
  }
}

async function usageReport(input: Record<string, unknown>): Promise<ActionOutcome> {
  const bridge = getBridge()
  if (!bridge) return refused('noBridge')

  const asked = oneOf(input, 'days', USAGE_PERIODS.map(String))
  const period: UsagePeriod =
    USAGE_PERIODS.find(one => String(one) === asked) ?? DEFAULT_USAGE_PERIOD

  return { ok: true, data: await bridge.scenario.usageReport(period) }
}

export const JOB_HANDLERS: ActionHandlers = {
  'model.schema': modelSchema,
  'cost.estimate': estimateCost,
  'job.get': readJob,
  'job.wait': waitForJob,
  'job.cancel': cancelJob,
  'usage.report': usageReport,
}
