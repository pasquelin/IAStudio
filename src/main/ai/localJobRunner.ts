import { PROMPT_FIELD_KEY } from '@shared/domain/localFields'
import type { LocalModel } from '@shared/domain/localModel'
import type { JobRunner, RemoteJob } from '@main/provider/jobManager'
import type { ChatRequest } from './localRuntimes'

/**
 * Generations run on THIS machine, behind the shape the job manager already speaks.
 *
 * 🛑 Blind spot: what a local job produces is TEXT, and nothing files text into a project yet.
 */

/** What a job on this machine amounts to. Statuses are the API's own words — see `JobStatus`. */
type LocalJob = {
  status: 'in-progress' | 'success' | 'failure'
  progress: number
  abort: AbortController
  /** What the model answered, once it has. Read through `outputOf`. */
  answer: string
}

export type LocalJobDeps = {
  /** The one round trip. Rejects on an abort, which is what `cancel` turns into a failure. */
  chat: (request: ChatRequest) => Promise<string>
  modelOf: (modelId: string) => LocalModel | null
  newId: () => string
  log: (level: 'info' | 'warn', message: string) => void
}

/**
 * How many finished jobs are remembered. `owns` reads this map, so a job cannot simply be dropped
 * when it settles — the poll that follows would then be routed to the cloud.
 */
const REMEMBERED = 64

export type LocalJobRunner = JobRunner & {
  /** What a finished job answered, or nothing — for whoever files it. */
  outputOf: (jobId: string) => string | null
  /** Whether this runner is the one that owns a job id, which is how a caller routes a poll. */
  owns: (jobId: string) => boolean
}

/** The prompt a body carries, under the key `localFields.ts` gives every modality. */
function promptOf(body: Record<string, unknown>): string {
  const prompt = body[PROMPT_FIELD_KEY]
  return typeof prompt === 'string' ? prompt : ''
}

export function createLocalJobRunner(deps: LocalJobDeps): LocalJobRunner {
  const jobs = new Map<string, LocalJob>()

  /**
   * Oldest first, which is what a `Map` iterates — and SETTLED only: evicting a running job makes
   * `owns` answer no, and the poll that follows is routed to a cloud that never heard of it.
   */
  const forget = (): void => {
    for (const [jobId, job] of jobs) {
      if (jobs.size <= REMEMBERED) return
      if (job.status !== 'in-progress') jobs.delete(jobId)
    }
  }

  const run = async (job: LocalJob, model: LocalModel, prompt: string): Promise<void> => {
    try {
      job.answer = await deps.chat({
        model: model.id,
        contextTokens: model.contextTokens ?? 0,
        messages: [{ role: 'user', content: prompt }],
        json: false,
        signal: job.abort.signal,
      })
      job.status = 'success'
      job.progress = 1
    } catch (error) {
      job.status = 'failure'
      deps.log('warn', `a local job of ${model.id} failed: ${String(error)}`)
    }
  }

  const answerFor = (jobId: string, job: LocalJob): RemoteJob => ({
    jobId,
    status: job.status,
    progress: job.progress,
    assetIds: [],
    // Nothing was billed, and saying zero is what keeps a local run out of the usage report as a
    // figure rather than as a hole.
    cost: 0,
  })

  return {
    submit: (target, body) => {
      const model = deps.modelOf(target.id)
      const jobId = `local_${deps.newId()}`
      // Working already: nothing queues on this machine, and the manager's own queue is what
      // bounds how many run at once. A local runtime reports tokens rather than a fraction of a
      // whole nobody knows, so a job that started is halfway and finishing is what moves the bar.
      const job: LocalJob = {
        status: model === null ? 'failure' : 'in-progress',
        progress: model === null ? 0 : 0.5,
        abort: new AbortController(),
        answer: '',
      }

      jobs.set(jobId, job)
      forget()
      if (model !== null) void run(job, model, promptOf(body))

      return Promise.resolve(answerFor(jobId, job))
    },

    poll: jobId => {
      const job = jobs.get(jobId)
      // Rejected rather than answered `failure`: a poll for a job nobody submitted is a routing
      // defect, and answering it would hide the defect behind an ordinary-looking outcome.
      if (!job) return Promise.reject(new Error(`${jobId} is not a job of this machine`))

      return Promise.resolve(answerFor(jobId, job))
    },

    cancel: jobId => {
      jobs.get(jobId)?.abort.abort()
      return Promise.resolve()
    },

    outputOf: jobId => jobs.get(jobId)?.answer ?? null,

    owns: jobId => jobs.has(jobId),
  }
}
