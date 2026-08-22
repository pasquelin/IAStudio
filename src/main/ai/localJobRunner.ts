import type { AssetType } from '@shared/domain/asset'
import { assetTypeOfModality, PROMPT_FIELD_KEY } from '@shared/domain/localFields'
import type { LocalModel } from '@shared/domain/localModel'
import type { JobRunner, RemoteJob } from '@main/provider/jobManager'
import type { ChatRequest, GenerateResult } from './localRuntimes'

/**
 * Generations run on THIS machine, behind the shape the job manager already speaks.
 *
 * Routed by MODALITY and not by calling `chat` outright: an image is not a sentence, and a runtime
 * that produces one answers a PATH. Which of the two a model wants is on the manifest.
 */

/** What a job on this machine amounts to. Statuses are the API's own words — see `JobStatus`. */
type LocalJob = {
  status: 'in-progress' | 'success' | 'failure'
  progress: number
  abort: AbortController
  /** What the model answered, once it has. Read through `outputOf`. */
  answer: string
  /** Where a generation landed, for whoever files it. Empty for a job that produced a sentence. */
  produced: LocalProduction | null
}

/**
 * A file a generation wrote, with what it was asked for.
 *
 * The prompt and the shelf travel WITH the file: the collector runs turns later, when the body
 * that carried them is gone, and naming an asset after the model that answered rather than after
 * what was asked makes a shelf where everything of one model reads the same.
 */
type LocalProduction = GenerateResult & {
  readonly type: AssetType
  readonly prompt: string
}

export type LocalJobDeps = {
  /** The one round trip. Rejects on an abort, which is what `cancel` turns into a failure. */
  chat: (request: ChatRequest) => Promise<string>
  /**
   * Produces something that is not a sentence. Absent for a model whose loader has no `generate`,
   * which is what makes an image target refuse readably instead of answering an empty string.
   */
  generate: (request: LocalGenerateRequest) => Promise<GenerateResult>
  modelOf: (modelId: string) => LocalModel | null
  newId: () => string
  log: (level: 'info' | 'warn', message: string) => void
}

type LocalGenerateRequest = {
  readonly model: string
  readonly prompt: string
  readonly fields: Readonly<Record<string, unknown>>
  readonly jobId: string
  readonly onProgress: (ratio: number) => void
  readonly signal: AbortSignal
}

/**
 * How many finished jobs are remembered. `owns` reads this map, so a job cannot simply be dropped
 * when it settles — the poll that follows would then be routed to the cloud.
 */
const REMEMBERED = 64

export type LocalJobRunner = JobRunner & {
  /** What a finished job answered, or nothing — for whoever files it. */
  outputOf: (jobId: string) => string | null
  /** The file a finished generation wrote, or nothing. It is the caller's to file, and to delete. */
  producedBy: (jobId: string) => LocalProduction | null
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

  const converse = async (job: LocalJob, model: LocalModel, prompt: string): Promise<void> => {
    job.answer = await deps.chat({
      model: model.id,
      contextTokens: model.contextTokens ?? 0,
      messages: [{ role: 'user', content: prompt }],
      json: false,
      signal: job.abort.signal,
    })
  }

  const produce = async (
    job: LocalJob,
    model: LocalModel,
    jobId: string,
    body: Record<string, unknown>,
  ): Promise<void> => {
    const type = model.modality ? assetTypeOfModality(model.modality) : null
    // Refused rather than filed somewhere: a modality with no shelf has nowhere for its output to
    // land, and writing the file anyway would leave bytes nothing ever points at.
    if (!type) throw new Error(`${model.modality} produces nothing this project can hold`)

    const written = await deps.generate({
      model: model.id,
      prompt: promptOf(body),
      fields: body,
      jobId,
      // A real fraction, pushed between two denoise steps — where a sentence has none to give.
      onProgress: ratio => (job.progress = ratio),
      signal: job.abort.signal,
    })

    job.produced = { ...written, type, prompt: promptOf(body) }
  }

  const run = async (
    job: LocalJob,
    model: LocalModel,
    jobId: string,
    body: Record<string, unknown>,
  ): Promise<void> => {
    try {
      // The manifest says which, and a modality it does not carry is a conversation — the only
      // thing this ran before there was anything else to run.
      if (model.modality === 'text' || model.modality === undefined) {
        await converse(job, model, promptOf(body))
      } else {
        await produce(job, model, jobId, body)
      }

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
        // A generation counts its steps and overwrites this at the first one; a conversation never
        // will, which is why a half is the only honest figure a sentence can start on.
        progress: model === null ? 0 : 0.5,
        abort: new AbortController(),
        answer: '',
        produced: null,
      }

      jobs.set(jobId, job)
      forget()
      if (model !== null) void run(job, model, jobId, body)

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

    producedBy: jobId => jobs.get(jobId)?.produced ?? null,

    owns: jobId => jobs.has(jobId),
  }
}
