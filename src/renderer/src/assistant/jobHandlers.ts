import { refused, type ActionOutcome } from '@shared/domain/assistant'
import { isFinished, type Job } from '@shared/domain/job'
import { DEFAULT_USAGE_PERIOD, USAGE_PERIODS, type UsagePeriod } from '@shared/domain/usage'
import { useJobs } from '@/stores/jobs'
import { withBridge, type ActionHandlers } from './actionHandler'
import { numberOf, recordOf, textOf } from './actionInputs'

/**
 * A generation, from what a model accepts to what came out of it.
 *
 * The jobs read here are the studio's own replica, kept up to date by the progress events the
 * `JobManager` broadcasts. Nothing here polls the API — one poller is the invariant.
 */

const DEFAULT_WAIT_MS = 60_000

/** The three windows the API prices, keyed by what a client writes. */
const PERIODS = new Map<string, UsagePeriod>(USAGE_PERIODS.map(period => [String(period), period]))

function jobOf(jobId: string): Job | null {
  return useJobs.getState().jobs.find(job => job.id === jobId) ?? null
}

/**
 * Waits for a job to reach a terminal state, on the store rather than on the API.
 *
 * A timeout answers the job as it stands rather than a refusal: "still running after a minute" is
 * an answer a client can act on, and a refusal would lose the progress along with it.
 */
function waitForJob(input: Record<string, unknown>): Promise<ActionOutcome> {
  const jobId = textOf(input, 'jobId') ?? ''
  const job = jobOf(jobId)
  if (!job) return Promise.resolve(refused('notFound'))
  if (isFinished(job.status)) return Promise.resolve({ ok: true, data: job })

  return new Promise(resolve => {
    /**
     * Both ways out are created before anything can take one, and `settle` is a declaration so it
     * is hoisted above them. `zustand` does not notify on subscribe — if it ever did, the listener
     * would throw on `timer` rather than resolve while leaving it running, which is the failure
     * worth having of the two.
     */
    const timer = setTimeout(
      () => settle(jobOf(jobId) ?? job),
      numberOf(input, 'timeoutMs') ?? DEFAULT_WAIT_MS,
    )

    const stop = useJobs.subscribe(state => {
      const seen = state.jobs.find(one => one.id === jobId)
      // Gone from the list is not a failure: a project closing takes its jobs with it, and the
      // last state this saw is more useful to answer than a refusal.
      if (!seen) settle(job)
      else if (isFinished(seen.status)) settle(seen)
    })

    function settle(answer: Job): void {
      stop()
      clearTimeout(timer)
      resolve({ ok: true, data: answer })
    }
  })
}

async function cancelJob(input: Record<string, unknown>): Promise<ActionOutcome> {
  const jobId = textOf(input, 'jobId') ?? ''
  if (!jobOf(jobId)) return refused('notFound')

  await useJobs.getState().cancel(jobId)
  return { ok: true }
}

/**
 * Both of these ask the API about something that may not be there. `failed` rather than
 * `badInput`: a rejection here is a model id nothing declares AND a network that dropped, and
 * nothing at this level tells the two apart — naming the caller's parameters guesses wrong half
 * the time.
 */
async function asking(run: () => Promise<ActionOutcome>): Promise<ActionOutcome> {
  try {
    return await run()
  } catch {
    return refused('failed')
  }
}

export const JOB_HANDLERS: ActionHandlers = {
  'job.wait': waitForJob,
  'job.cancel': cancelJob,

  'job.get': input => {
    const job = jobOf(textOf(input, 'jobId') ?? '')
    return job ? { ok: true, data: job } : refused('notFound')
  },

  'model.schema': input =>
    asking(() =>
      withBridge(bridge => bridge.scenario.describeModel(textOf(input, 'modelId') ?? '')),
    ),

  // `null` is a legitimate answer and travels as one: the API declines to price some models, and
  // a figure invented to fill the field would be worse than admitting there is none.
  'cost.estimate': input =>
    asking(() =>
      withBridge(bridge =>
        bridge.scenario.estimateCost(
          { id: textOf(input, 'modelId') ?? '' },
          recordOf(input, 'parameters') ?? {},
        ),
      ),
    ),

  'usage.report': input =>
    withBridge(bridge =>
      bridge.scenario.usageReport(PERIODS.get(textOf(input, 'days') ?? '') ?? DEFAULT_USAGE_PERIOD),
    ),

  // `false` says nothing was running under that id, which is a click that arrived late rather
  // than a failure — so it travels as the answer it is.
  'task.cancel': input =>
    withBridge(bridge => bridge.tasks.cancel(textOf(input, 'taskId') ?? '')),
}
