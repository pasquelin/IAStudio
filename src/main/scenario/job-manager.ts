import type { JobFailure } from '@shared/domain/failure'
import { isFinished, type Job, type JobProgress, type JobStatus } from '@shared/domain/job'
import type { ActivityReport } from '@main/project/activity-log'
import { failureOf } from './client'
import { createRetry, DEFAULT_BACKOFF_BASE_MS } from './retry'

/** A job as the API returns it, reduced to what the studio reads. */
export type RemoteJob = {
  jobId: string
  status: string
  progress?: number
  metadata?: { assetIds?: readonly string[] }
}

export type JobRunner = {
  submit: (modelId: string, body: Record<string, unknown>) => Promise<RemoteJob>
  poll: (jobId: string) => Promise<RemoteJob>
  cancel: (jobId: string) => Promise<void>
}

/**
 * Brings a finished job's outputs into the project. Separate from the runner because it is
 * not an API call but a disk write — and because a job is not done until it lands.
 */
export type AssetCollector = (job: Job, remoteAssetIds: readonly string[]) => Promise<string[]>

/**
 * What a job addresses its account through, captured at submission so that it finishes on the
 * one that launched it. Resolved per call instead, an account switch mid-flight has the next
 * poll ask the new key about the previous account's job id: the API answers 404, no retry can
 * fix a 404, and a ten-minute video generation dies on a switch unrelated to it.
 *
 * `collect` is here for the one dependency of its own that is account-scoped — retrieving the
 * outputs is an API call, and a signed URL fetched under the wrong key answers 404 too.
 */
export type JobAccount = {
  runner: JobRunner
  collect: AssetCollector
}

export type JobManagerDeps = {
  /** The account in force, or `null` when no credentials are available. Read once per job. */
  account: () => JobAccount | null
  concurrency: () => number
  maxRetries: () => number
  onProgress: (progress: JobProgress) => void
  /** Where a finished generation says what became of it. See `ActivityLog`. */
  record: (report: ActivityReport) => void
  now: () => string
  newId: () => string
  sleep: (ms: number) => Promise<void>
  pollIntervalMs?: number
  backoffBaseMs?: number
}

export type JobManager = {
  submit: (modelId: string, label: string, body: Record<string, unknown>) => Job
  cancel: (jobId: string) => Promise<void>
  list: () => Job[]
}

const DEFAULT_POLL_INTERVAL_MS = 2000

/** Finished jobs kept for the bar's history. Beyond this a long session is just a leak. */
const RETAINED_JOBS = 200

/**
 * The API spells eight states, the studio has five. `warming-up` and `finalizing` are running
 * states, not states of their own; an unknown one is treated as running, so a status Scenario
 * adds keeps the job polling instead of declaring an outcome nobody understood.
 *
 * `succeeded` and `failed` are insurance, not observation: the SDK types give a workflow job
 * the same eight spellings as a generation, while the prose guide gives it these two. They cost
 * two rows and no collision — and without them, the guide being right means a workflow job
 * polls for ever while holding its place in the concurrency count.
 */
const STATUS: Record<string, JobStatus> = {
  pending: 'queued',
  queued: 'queued',
  'warming-up': 'running',
  'in-progress': 'running',
  finalizing: 'running',
  success: 'succeeded',
  succeeded: 'succeeded',
  failure: 'failed',
  failed: 'failed',
  canceled: 'cancelled',
}

export function jobStatusOf(remoteStatus: string): JobStatus {
  // Own keys only: a status spelled like an inherited member would otherwise resolve to one.
  return Object.hasOwn(STATUS, remoteStatus) ? (STATUS[remoteStatus] ?? 'running') : 'running'
}

/**
 * A progress reading above this is a percentage, below it a fraction. Not 1: generation
 * overshoots its own scale — `ProgressBar` is clamped because a job reports 1.02 — so dividing
 * from 1 would show the end of a generation as 1 %.
 */
const PERCENTAGE_ABOVE = 2

/**
 * Progress as the fraction `Job.progress` promises, which several surfaces sum.
 *
 * The SDK types say 0–1 for every job type; the prose guide says 0–100 for a workflow one, and
 * reading the larger scale costs nothing if the types are right. Anything outside either scale
 * is out of contract and clamped rather than passed on — NaN included, which would otherwise
 * emit on every poll, `NaN !== NaN` defeating the guard that only emits on change.
 */
export function jobProgressOf(reported: number): number {
  if (!Number.isFinite(reported)) return 0

  const fraction = reported > PERCENTAGE_ABOVE ? reported / 100 : reported
  return Math.min(Math.max(fraction, 0), 1)
}

type Entry = {
  job: Job
  /** Captured when the user asked for it: the credits and the output belong to that account. */
  account: JobAccount | null
  body: Record<string, unknown>
  remoteId: string | null
  cancelled: boolean
}

/**
 * Owns the queue, the concurrency and the polling. The only place in the codebase that polls:
 * `job.wait()` from the SDK reports no progress and gives up after two minutes, which a video
 * generation exceeds on its own — see CLAUDE.md.
 */
export function createJobManager({
  account,
  concurrency,
  maxRetries,
  onProgress,
  record,
  now,
  newId,
  sleep,
  pollIntervalMs = DEFAULT_POLL_INTERVAL_MS,
  backoffBaseMs = DEFAULT_BACKOFF_BASE_MS,
}: JobManagerDeps): JobManager {
  const entries = new Map<string, Entry>()
  const queue: string[] = []
  let running = 0

  const emit = (entry: Entry): void => {
    const progress: JobProgress = {
      id: entry.job.id,
      status: entry.job.status,
      progress: entry.job.progress,
    }
    if (entry.job.assetIds.length > 0) progress.assetIds = entry.job.assetIds
    if (entry.job.error !== undefined) progress.error = entry.job.error
    onProgress(progress)
  }

  /** Insertion order is submission order, so the oldest finished entries go first. */
  const evictOldFinished = (): void => {
    const finished = [...entries.values()].filter(candidate => isFinished(candidate.job.status))

    for (const stale of finished.slice(0, finished.length - RETAINED_JOBS)) {
      entries.delete(stale.job.id)
    }
  }

  /**
   * What a finished job leaves behind for someone to read.
   *
   * A generation is minutes spent elsewhere: the progress bar is gone by the time it ends, and
   * a failure that only reached the terminal was a failure nobody was there for.
   */
  const journal = (job: Job, status: JobStatus): void => {
    if (status === 'succeeded') {
      if (job.assetIds.length > 0) {
        record({
          level: 'info',
          topic: 'generation',
          messageKey: 'activity.generated',
          params: { count: job.assetIds.length },
        })
      }
      return
    }

    record({
      level: status === 'failed' ? 'error' : 'info',
      topic: 'generation',
      messageKey: status === 'failed' ? 'activity.jobFailed' : 'activity.jobCancelled',
      params: { name: job.label },
    })
  }

  const settle = (entry: Entry, status: JobStatus, error?: JobFailure): void => {
    entry.job.status = status
    entry.job.finishedAt = now()
    entry.body = {}
    // Released with the body, and for the same reason: the SDK client behind it holds an HTTP
    // agent and its sockets, and a finished job would keep a switched-away account's alive for
    // the rest of the session. `execute` holds its own reference, and `cancel` returns before
    // this on a finished job.
    entry.account = null
    if (status === 'succeeded') entry.job.progress = 1
    if (error !== undefined) entry.job.error = error
    emit(entry)
    journal(entry.job, status)
    evictOldFinished()
  }

  const withRetry = createRetry({ maxRetries, sleep, backoffBaseMs })

  const advance = (entry: Entry, remote: RemoteJob): JobStatus => {
    const status = jobStatusOf(remote.status)
    const progress = jobProgressOf(remote.progress ?? entry.job.progress)

    // An outcome is announced by `settle` alone, and only once it is actually complete: a
    // success emitted here would reach the jobs bar before the asset exists on disk.
    if (isFinished(status)) return status

    if (status !== entry.job.status || progress !== entry.job.progress) {
      entry.job.status = status
      entry.job.progress = progress
      emit(entry)
    }

    return status
  }

  const execute = async (entry: Entry): Promise<void> => {
    const { account: bound } = entry
    // No key when the user asked, and none is borrowed from whoever holds one now.
    if (!bound) {
      settle(entry, 'failed', 'missing')
      return
    }

    try {
      const submitted = await withRetry(() => bound.runner.submit(entry.job.modelId, entry.body))
      entry.remoteId = submitted.jobId

      // The body is read once and can hold an encoded source image; a finished job has no
      // reason to keep it alive for the rest of the session.
      entry.body = {}

      // Cancelled while the submission was in flight: the remote job exists, so it must be
      // told, otherwise it keeps burning credits with nobody watching.
      const abandon = async (): Promise<void> => {
        await bound.runner.cancel(submitted.jobId).catch(() => {})
        settle(entry, 'cancelled')
      }

      if (entry.cancelled) return await abandon()

      let remote = submitted
      let status = advance(entry, remote)

      while (!isFinished(status)) {
        await sleep(pollIntervalMs)
        if (entry.cancelled) return await abandon()

        remote = await withRetry(() => bound.runner.poll(submitted.jobId))
        status = advance(entry, remote)
      }

      if (status !== 'succeeded') {
        settle(entry, status, status === 'failed' ? 'rejected' : undefined)
        return
      }

      // Succeeded only once the files are on disk and indexed: announcing it earlier shows a
      // finished job with nothing behind it in the asset browser.
      try {
        entry.job.assetIds = await bound.collect(entry.job, remote.metadata?.assetIds ?? [])
      } catch {
        // Writing or indexing failed — a local problem, distinct from anything the API said.
        settle(entry, 'failed', 'storage')
        return
      }

      settle(entry, 'succeeded')
    } catch (error) {
      settle(entry, 'failed', failureOf(error))
    }
  }

  const pump = (): void => {
    while (running < concurrency()) {
      const id = queue.shift()
      if (id === undefined) return

      const entry = entries.get(id)
      if (!entry) continue

      if (entry.cancelled) {
        settle(entry, 'cancelled')
        continue
      }

      running++
      void execute(entry).finally(() => {
        running--
        pump()
      })
    }
  }

  return {
    submit: (modelId, label, body) => {
      const job: Job = {
        id: newId(),
        modelId,
        label,
        status: 'queued',
        progress: 0,
        createdAt: now(),
        assetIds: [],
      }

      const entry: Entry = { job, account: account(), body, remoteId: null, cancelled: false }
      entries.set(job.id, entry)
      queue.push(job.id)
      emit(entry)
      pump()

      return job
    },

    cancel: async jobId => {
      const entry = entries.get(jobId)
      if (!entry || isFinished(entry.job.status)) return

      entry.cancelled = true

      // Still queued: it leaves the queue and never reaches the API at all.
      const position = queue.indexOf(jobId)
      if (position >= 0) {
        queue.splice(position, 1)
        settle(entry, 'cancelled')
        return
      }

      // On the account that submitted it, whichever one is active now.
      if (entry.remoteId) await entry.account?.runner.cancel(entry.remoteId).catch(() => {})
    },

    list: () =>
      [...entries.values()]
        .map(entry => entry.job)
        .sort((left, right) => right.createdAt.localeCompare(left.createdAt)),
  }
}
