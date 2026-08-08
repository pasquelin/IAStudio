import type { JobFailure } from '@shared/domain/failure'
import { isFinished, type Job, type JobProgress, type JobStatus } from '@shared/domain/job'
import type { ActivityReport } from '@main/project/activity-log'
import { failureOf } from './client'
import type { PersistedJob } from './job-store'
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

/** The account in force, named so a job outliving the session can find its way back to it. */
export type ActiveAccount = { id: string; account: JobAccount }

export type JobAccounts = {
  /** `null` when no credentials are available. Read once per job, at submission. */
  active: () => ActiveAccount | null
  /** The account a resumed job was submitted on, or `null` if the studio no longer holds it. */
  of: (accountId: string) => JobAccount | null
}

export type JobManagerDeps = {
  accounts: JobAccounts
  /** The project a job's outputs belong in, captured at submission like the account is. */
  projectPath: () => string | null
  /**
   * Where unfinished jobs are kept so that closing the studio does not abandon them. `handled`
   * is every job this session is answering for, finished ones included: what the store may
   * replace, as against the entries of a project nobody has reopened.
   */
  persist: (jobs: readonly PersistedJob[], handled: readonly string[]) => void
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
  /**
   * Picks up jobs left running by a previous session: polling starts again, and one that
   * finished while the studio was closed is collected into the project it was meant for.
   */
  resume: (jobs: readonly PersistedJob[]) => void
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
  /** Kept beside the account itself, because it is the half that survives the session. */
  accountId: string | null
  /** Likewise: where the outputs go, decided when the job was asked for, not when it lands. */
  projectPath: string | null
  body: Record<string, unknown>
  remoteId: string | null
  cancelled: boolean
  /**
   * Whether the API has said what became of it, and its outputs are where they belong.
   *
   * The one thing that decides whether the note may be dropped. A job can fail here while it is
   * alive and paid for over there — a poll past its retry budget, a key the keychain would not
   * hand back, a disk that refused the download — and forgetting it then is the exact loss this
   * whole mechanism exists to prevent.
   */
  done: boolean
}

/**
 * Owns the queue, the concurrency and the polling. The only place in the codebase that polls:
 * `job.wait()` from the SDK reports no progress and gives up after two minutes, which a video
 * generation exceeds on its own — see CLAUDE.md.
 */
export function createJobManager({
  accounts,
  projectPath,
  persist,
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

  /**
   * Writes down what would otherwise be lost with the process.
   *
   * Only what is still running and has reached the API: a job the studio never submitted costs
   * nothing to forget, and a finished one has nothing left to do.
   */
  const remember = (): void => {
    const unfinished: PersistedJob[] = []

    for (const entry of entries.values()) {
      const { accountId, projectPath, remoteId } = entry
      if (entry.done) continue
      if (remoteId === null || accountId === null || projectPath === null) continue

      unfinished.push({
        id: entry.job.id,
        remoteId,
        modelId: entry.job.modelId,
        label: entry.job.label,
        accountId,
        projectPath,
        createdAt: entry.job.createdAt,
      })
    }

    persist(unfinished, [...entries.keys()])
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
    remember()
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

  /**
   * A job that exists on the API, followed to its end. Shared by the one just submitted and the
   * one picked up from a previous session — from here on the two are the same thing, which is
   * what makes a job survive the studio being closed.
   */
  const follow = async (
    entry: Entry,
    bound: JobAccount,
    remoteId: string,
    submitted?: RemoteJob,
  ): Promise<void> => {
    // Cancelled while the submission was in flight: the remote job exists, so it must be told,
    // otherwise it keeps burning credits with nobody watching.
    const abandon = async (): Promise<void> => {
      // Only once the API has taken the cancellation: refused, the job is still running and
      // still being paid for, so its note has to outlive the session that gave up on it.
      await bound.runner
        .cancel(remoteId)
        .then(() => void (entry.done = true))
        .catch(() => {})
      settle(entry, 'cancelled')
    }

    if (entry.cancelled) return await abandon()

    let remote = submitted ?? (await withRetry(() => bound.runner.poll(remoteId)))
    let status = advance(entry, remote)

    while (!isFinished(status)) {
      await sleep(pollIntervalMs)
      if (entry.cancelled) return await abandon()

      remote = await withRetry(() => bound.runner.poll(remoteId))
      status = advance(entry, remote)
    }

    if (status !== 'succeeded') {
      // The API has spoken, and nothing is owed: this one may be forgotten.
      entry.done = true
      settle(entry, status, status === 'failed' ? 'rejected' : undefined)
      return
    }

    // Where the outputs are owed. The collector writes into whichever project is open, so
    // collecting under another one would file this generation in the wrong library — the note
    // stays instead, and the job is picked up again when its own project is next opened.
    if (entry.projectPath !== null && entry.projectPath !== projectPath()) {
      entries.delete(entry.job.id)
      return
    }

    // Succeeded only once the files are on disk and indexed: announcing it earlier shows a
    // finished job with nothing behind it in the asset browser.
    try {
      entry.job.assetIds = await bound.collect(entry.job, remote.metadata?.assetIds ?? [])
    } catch {
      // Writing or indexing failed — a local problem, distinct from anything the API said, and
      // one the note must outlive: the generation is paid for and its outputs are still there.
      settle(entry, 'failed', 'storage')
      return
    }

    entry.done = true
    settle(entry, 'succeeded')
  }

  const execute = async (entry: Entry): Promise<void> => {
    const { account: bound, remoteId } = entry
    // No key when the user asked, and none is borrowed from whoever holds one now. A resumed job
    // whose account the studio no longer holds is the same answer: its id means nothing under
    // another key, and no retry repairs a 404.
    if (!bound) {
      settle(entry, 'failed', 'missing')
      return
    }

    try {
      if (remoteId !== null) return await follow(entry, bound, remoteId)

      const submitted = await withRetry(() => bound.runner.submit(entry.job.modelId, entry.body))
      entry.remoteId = submitted.jobId

      // The body is read once and can hold an encoded source image; a finished job has no
      // reason to keep it alive for the rest of the session.
      entry.body = {}
      // The first moment there is anything worth surviving the process: before this, nothing
      // was spent and forgetting the job costs nobody anything.
      remember()

      await follow(entry, bound, submitted.jobId, submitted)
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

      const active = accounts.active()
      const entry: Entry = {
        job,
        account: active?.account ?? null,
        accountId: active?.id ?? null,
        projectPath: projectPath(),
        body,
        remoteId: null,
        cancelled: false,
        done: false,
      }
      entries.set(job.id, entry)
      queue.push(job.id)
      emit(entry)
      pump()

      return job
    },

    resume: stored => {
      for (const remembered of stored) {
        // A job the session already knows is the one that wrote this entry, not a second copy.
        if (entries.has(remembered.id)) continue

        const job: Job = {
          id: remembered.id,
          modelId: remembered.modelId,
          label: remembered.label,
          status: 'queued',
          progress: 0,
          createdAt: remembered.createdAt,
          assetIds: [],
        }

        const entry: Entry = {
          job,
          account: accounts.of(remembered.accountId),
          accountId: remembered.accountId,
          projectPath: remembered.projectPath,
          body: {},
          // What makes `execute` follow it rather than submit it a second time.
          remoteId: remembered.remoteId,
          cancelled: false,
          done: false,
        }

        entries.set(job.id, entry)
        queue.push(job.id)
        // Announced like a submission is: behind the concurrency bound it would otherwise be
        // invisible in the jobs bar until its turn came.
        emit(entry)
      }

      pump()
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

      // On the account that submitted it, whichever one is active now. The note goes with the
      // API taking it, and not before: refused, the job is still running and still being paid
      // for, so it has to outlive the session that gave up on it.
      if (entry.remoteId) {
        await entry.account?.runner
          .cancel(entry.remoteId)
          .then(() => {
            entry.done = true
            remember()
          })
          .catch(() => {})
      }
    },

    list: () =>
      [...entries.values()]
        .map(entry => entry.job)
        .sort((left, right) => right.createdAt.localeCompare(left.createdAt)),
  }
}
