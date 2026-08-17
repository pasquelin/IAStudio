import type { ApiFailure, JobFailure } from '@shared/domain/failure'
import { clamp } from '@shared/numeric'
import { byCodeUnit } from '@shared/text'
import type { WorkspaceId } from '@shared/domain/workspace'
import {
  INTERACTIVE_REQUESTS_PER_MINUTE,
  isFinished,
  type Job,
  type JobProgress,
  type JobStatus,
  type JobTarget,
  settlementOf,
} from '@shared/domain/job'
import type { ActivityReport } from '@main/project/activity-log'
import { failureOf } from './client'
import type { PersistedJob } from './persisted-job'
import { ORDINARY_REQUESTS_PER_WINDOW } from './rate-limiter'
import { createRetry, DEFAULT_BACKOFF_BASE_MS } from './retry'

/**
 * A job as the runner hands it over, reduced to what the studio reads. Whichever endpoint ran
 * it, and however that endpoint reports its outputs — see `outputsOf` in `runner.ts`.
 */
export type RemoteJob = {
  jobId: string
  status: string
  progress?: number
  /** What it has produced so far, as remote asset ids. */
  assetIds: readonly string[]
  /** On a submission, and on a poll too — which is where a resumed job finds its own. */
  cost?: number
}

export type JobRunner = {
  submit: (target: JobTarget, body: Record<string, unknown>) => Promise<RemoteJob>
  poll: (jobId: string) => Promise<RemoteJob>
  cancel: (jobId: string) => Promise<void>
}

/**
 * What a collected generation left in the project: the local ids, and the shelves they landed
 * in — deduplicated, in the order the outputs came back.
 *
 * The shelves are returned rather than recomputed, because the collector is the only place that
 * ever knows them: it reads each output's type off the API answer and files it accordingly. An
 * App produces what it produces, whichever space it was launched from, so where the result went
 * is the one thing the person waiting cannot guess.
 */
export type CollectedOutputs = {
  ids: string[]
  workspaces: WorkspaceId[]
}

/**
 * Brings a finished job's outputs into the project. Separate from the runner because it is
 * not an API call but a disk write — and because a job is not done until it lands.
 */
export type AssetCollector = (
  job: Job,
  remoteAssetIds: readonly string[],
) => Promise<CollectedOutputs>

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
type ActiveAccount = { id: string; account: JobAccount }

type JobAccounts = {
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
  /**
   * Turns the local asset ids a body carries into the ones the API answers to, sending a file
   * up where it has no twin yet. Injected rather than reached for: it needs the catalogue and
   * the cloud backend, neither of which this file knows anything about.
   */
  resolveAssetInputs: (body: Record<string, unknown>) => Promise<Record<string, unknown>>
  onProgress: (progress: JobProgress) => void
  /** Told when the list gains or loses an entry. See `onJobsChanged` in `shared/ipc.ts`. */
  onListChanged: (jobs: readonly Job[]) => void
  /** Where a finished generation says what became of it. See `ActivityLog`. */
  record: (report: ActivityReport) => void
  now: () => string
  newId: () => string
  sleep: (ms: number) => Promise<void>
  pollIntervalMs?: number
  backoffBaseMs?: number
}

export type JobManager = {
  submit: (target: JobTarget, label: string, body: Record<string, unknown>) => Job
  /**
   * Runs a model the user did not ask to watch, and answers what became of it.
   *
   * For the assistant's own reasoning: it needs the same queue, the same concurrency bound and
   * the same retries as any other call to the API — polling anywhere else is a bug — but none of
   * what surrounds a generation. Nothing is collected, listed, journalled or persisted.
   *
   * The job carries the API's own asset ids rather than local ones, because nothing was
   * downloaded: the answer is read from the asset itself.
   */
  run: (target: JobTarget, label: string, body: Record<string, unknown>) => Promise<Job>
  cancel: (jobId: string) => Promise<void>
  list: () => Job[]
  /**
   * Picks up jobs left running by a previous session: polling starts again, and one that
   * finished while the studio was closed is collected into the project it was meant for.
   */
  resume: (jobs: readonly PersistedJob[]) => void
}

const DEFAULT_POLL_INTERVAL_MS = 2000

/**
 * What the poll loop alone may spend.
 *
 * Left at two seconds whatever the load, four concurrent jobs ask for 120 a minute against the
 * hundred the API grants: the limiter then holds every poll, the SDK retries, and a generation
 * that is running and being paid for is reported as a rate-limit failure fifteen seconds in.
 *
 * Derived and not written down: the budget it stays under is three constants of `rate-limiter.ts`
 * away, and stated as prose it would go quietly false the day one of them is tuned — with that
 * same failure as the symptom.
 */
export const POLL_REQUESTS_PER_MINUTE =
  ORDINARY_REQUESTS_PER_WINDOW - INTERACTIVE_REQUESTS_PER_MINUTE

/** Finished jobs kept for the bar's history. Beyond this a long session is just a leak. */
const RETAINED_JOBS = 200

/**
 * The one answer that settles a job's fate for good: the API says it has no such job.
 *
 * A short list rather than `isRetryable`, which answers a different question — whether asking
 * again might work — and agrees with this one only by coincidence. Keeping the note is the
 * default because the two mistakes do not cost the same: an entry replayed for nothing is
 * noise, an entry dropped is a paid generation abandoned. So `missing` and `invalid-credentials`
 * stay, the user may yet re-add the key and the fingerprint naming the account is the same one;
 * `forbidden` stays, a scope the key lost says nothing about a job that is still running and
 * still billed; and `unexpected` stays, which this `catch` also reaches for anything thrown
 * outside the SDK. `rejected` is not here because it cannot arrive here — the API pronouncing a
 * job failed is `follow`'s business, and it settles `done` itself.
 */
const SETTLED_FOR_GOOD: ReadonlySet<ApiFailure> = new Set(['not-found'])

/**
 * The API spells eight states, the studio has five. `warming-up` and `finalizing` are running
 * states, not states of their own; an unknown one is treated as running, so a status Scenario
 * adds keeps the job polling instead of declaring an outcome nobody understood.
 *
 * `succeeded` and `failed` are insurance, not observation: the SDK types spell eight states and
 * the prose guide has been seen using these two instead. They cost two rows and no collision —
 * and without them, the guide being right means a job polls for ever while holding its place in
 * the concurrency count.
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
 * The SDK types say 0–1; the prose guide has been seen saying 0–100, and reading the larger
 * scale costs nothing if the types are right. Anything outside either scale
 * is out of contract and clamped rather than passed on — NaN included, which would otherwise
 * emit on every poll, `NaN !== NaN` defeating the guard that only emits on change.
 */
export function jobProgressOf(reported: number): number {
  if (!Number.isFinite(reported)) return 0

  const fraction = reported > PERCENTAGE_ABOVE ? reported / 100 : reported
  return clamp(fraction, 0, 1)
}

type Entry = {
  job: Job
  /**
   * A job nobody asked to see.
   *
   * The assistant runs a text model to work out what a sentence meant, and that is machinery,
   * not a generation: it must not appear in the jobs bar, must not be written to the journal,
   * must not be resumed on the next launch, and above all its output must not be collected —
   * the answer is a fragment of JSON, and the asset browser is for the user's own work.
   *
   * Everything else it keeps: the queue, the concurrency bound, the retries, the single poll
   * loop. That is the whole reason it lives here rather than in a poller of its own.
   */
  discreet: boolean
  /** Resolved once the job has settled, for a caller that awaits its outcome rather than watching. */
  settled: ((job: Job) => void) | null
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
  resolveAssetInputs,
  onProgress,
  onListChanged,
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

  /**
   * How long to wait before asking again, given how many jobs are being followed at once.
   *
   * Never faster than `pollIntervalMs`, which is what one or two generations get: a progress bar
   * that moves is worth the requests. From the third on, the interval stretches by itself rather
   * than have the studio ask for more than the API grants — the alternative is not a slower bar,
   * it is live generations reported as failures.
   */
  const pollDelay = (): number =>
    Math.max(pollIntervalMs, Math.ceil((running * 60_000) / POLL_REQUESTS_PER_MINUTE))

  const emit = (entry: Entry): void => {
    // Nothing is drawing it, and a window told about a job it will never list would merge
    // progress into an entry it has no row for.
    if (entry.discreet) return

    const progress: JobProgress = {
      id: entry.job.id,
      status: entry.job.status,
      progress: entry.job.progress,
    }
    if (entry.job.assetIds.length > 0) progress.assetIds = entry.job.assetIds
    if (entry.job.error !== undefined) progress.error = entry.job.error
    if (entry.job.cost !== undefined) progress.cost = entry.job.cost
    onProgress(progress)
  }

  /** The list gained or lost an entry — neither of which a progress event can express. */
  const announceList = (): void => onListChanged(listed())

  const listed = (): Job[] =>
    [...entries.values()]
      .filter(entry => !entry.discreet)
      .map(entry => entry.job)
      .sort((left, right) => byCodeUnit(right.createdAt, left.createdAt))

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
      // A conversation does not resume across launches: picked up tomorrow, a reasoning step
      // would answer a question nobody is still asking, on an account it would charge for it.
      if (entry.discreet) continue
      if (remoteId === null || accountId === null || projectPath === null) continue

      unfinished.push({
        id: entry.job.id,
        remoteId,
        targetId: entry.job.targetId,
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
    const stale = finished.slice(0, finished.length - RETAINED_JOBS)

    for (const entry of stale) entries.delete(entry.job.id)
    // The other way the list loses an entry. Nothing in a replica prunes on its own, so left
    // unsaid this one would drift past the retained count for the rest of the session.
    if (stale.length > 0) announceList()
  }

  /**
   * What a finished job leaves behind for someone to read.
   *
   * A generation is minutes spent elsewhere: the progress bar is gone by the time it ends, and
   * a failure that only reached the terminal was a failure nobody was there for.
   */
  const journal = (job: Job, status: JobStatus, workspaces: WorkspaceId[] = []): void => {
    if (status === 'succeeded') {
      if (job.assetIds.length > 0) {
        // Two keys rather than one with an empty clause: a line written before the shelves were
        // reported — or by a collection that named none — must not read "generated into ".
        record({
          level: 'info',
          topic: 'generation',
          messageKey: workspaces.length > 0 ? 'activity.generatedInto' : 'activity.generated',
          // Where they landed, which is not where the person was: an App produces what it
          // produces whichever space launched it, so a run started in 3D can leave a picture in
          // the Image shelf. Ids, never names — the window says them in its own language.
          params: { count: job.assetIds.length, ...(workspaces.length > 0 ? { workspaces } : {}) },
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

  const settle = (
    entry: Entry,
    status: JobStatus,
    error?: JobFailure,
    workspaces?: WorkspaceId[],
  ): void => {
    entry.job.status = status
    // Assigned onto the job rather than replacing it: `collect` holds this very object across an
    // await, and `list` hands it out — a fresh one here would leave both on the unsettled job.
    Object.assign(entry.job, settlementOf(status, now()))
    const awaiting = entry.settled
    entry.settled = null
    entry.body = {}
    // Released with the body, and for the same reason: the SDK client behind it holds an HTTP
    // agent and its sockets, and a finished job would keep a switched-away account's alive for
    // the rest of the session. `execute` holds its own reference, and `cancel` returns before
    // this on a finished job.
    entry.account = null
    if (error !== undefined) entry.job.error = error
    emit(entry)
    // A discreet job is machinery: the journal exists so a generation that ended while nobody
    // was watching can still be read about, and there is nothing here for anyone to read.
    if (!entry.discreet) journal(entry.job, status, workspaces)
    evictOldFinished()
    remember()
    // Last, and outside everything above: whoever awaited this resumes on it, and a throw there
    // must not leave the bookkeeping half done.
    awaiting?.(entry.job)
  }

  /**
   * Tells the API about a job the studio has given up on, and settles it either way.
   *
   * The note goes with the API taking it, and not before: refused, the job is still running and
   * still being paid for, so it has to outlive the session that gave up on it.
   */
  const abandon = async (entry: Entry, bound: JobAccount, remoteId: string): Promise<void> => {
    await bound.runner
      .cancel(remoteId)
      .then(() => void (entry.done = true))
      .catch(() => {})
    settle(entry, 'cancelled')
  }

  const withRetry = createRetry({ maxRetries, sleep, backoffBaseMs })

  const advance = (entry: Entry, remote: RemoteJob): JobStatus => {
    const status = jobStatusOf(remote.status)
    const progress = jobProgressOf(remote.progress ?? entry.job.progress)

    // Before the early return: a resumed job's cost only ever arrives by poll, outcome included.
    const priced = remote.cost !== undefined && remote.cost !== entry.job.cost
    if (priced) entry.job.cost = remote.cost

    // An outcome is announced by `settle` alone, and only once it is actually complete: a
    // success emitted here would reach the jobs bar before the asset exists on disk.
    if (isFinished(status)) return status

    if (priced || status !== entry.job.status || progress !== entry.job.progress) {
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
    if (entry.cancelled) return await abandon(entry, bound, remoteId)

    let remote = submitted ?? (await withRetry(() => bound.runner.poll(remoteId)))
    let status = advance(entry, remote)

    while (!isFinished(status)) {
      await sleep(pollDelay())
      if (entry.cancelled) return await abandon(entry, bound, remoteId)

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
      // Said out loud, because it is the one exit that leaves no outcome behind: a replica told
      // nothing would keep drawing this job as running for the rest of the session, with a
      // cancel button the manager no longer has an entry for.
      announceList()
      return
    }

    /**
     * Nothing is brought down for a discreet job, and the ids kept are the API's own.
     *
     * This is the line that keeps the assistant out of the asset browser: its answers stay
     * where Scenario put them — useful as a history, over there — and the studio's library goes
     * on holding only what the person made.
     */
    if (entry.discreet) {
      entry.job.assetIds = [...remote.assetIds]
      entry.done = true
      settle(entry, 'succeeded')
      return
    }

    // Succeeded only once the files are on disk and indexed: announcing it earlier shows a
    // finished job with nothing behind it in the asset browser.
    let landed: CollectedOutputs
    try {
      landed = await bound.collect(entry.job, remote.assetIds)
      entry.job.assetIds = landed.ids
    } catch {
      // Writing or indexing failed — a local problem, distinct from anything the API said, and
      // one the note must outlive: the generation is paid for and its outputs are still there.
      settle(entry, 'failed', 'storage')
      return
    }

    entry.done = true
    settle(entry, 'succeeded', undefined, landed.workspaces)
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

      const target: JobTarget = { id: entry.job.targetId }
      // Here rather than at the IPC boundary, because sending a picture up is a file transfer of
      // any size: done before the job exists, it holds the channel open with nothing queued on
      // screen and outside this loop's concurrency bound. Retried like the submission beside it —
      // it is the longer of the two on the wire, so it is the one a dropped connection finds.
      const body = await withRetry(() => resolveAssetInputs(entry.body))
      const submitted = await withRetry(() => bound.runner.submit(target, body))
      entry.remoteId = submitted.jobId
      if (submitted.cost !== undefined) entry.job.cost = submitted.cost

      // The body is read once and can hold an encoded source image; a finished job has no
      // reason to keep it alive for the rest of the session.
      entry.body = {}
      // The first moment there is anything worth surviving the process: before this, nothing
      // was spent and forgetting the job costs nobody anything.
      remember()

      await follow(entry, bound, submitted.jobId, submitted)
    } catch (error) {
      // What the user asked for wins over how it ended. Nothing reaches the work already under
      // way — an upload runs to its end — so a cancelled job that then fails on the wire would
      // otherwise be reported as an error, and written to the journal as one.
      if (entry.cancelled) {
        entry.done = true
        settle(entry, 'cancelled')
        return
      }

      const failure = failureOf(error)
      entry.done = SETTLED_FOR_GOOD.has(failure)
      settle(entry, 'failed', failure)
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

  /** Puts a job in the queue and starts the loop on it. Shared by both ways of asking. */
  const enqueue = (
    target: JobTarget,
    label: string,
    body: Record<string, unknown>,
    discreet: boolean,
    settledCallback: ((job: Job) => void) | null,
  ): Job => {
    const job: Job = {
      id: newId(),
      targetId: target.id,
      label,
      status: 'queued',
      progress: 0,
      createdAt: now(),
      assetIds: [],
    }

    const active = accounts.active()
    const entry: Entry = {
      job,
      discreet,
      settled: settledCallback,
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
    // The window that asked already holds this job — it pushed what the IPC call returned —
    // but every other one only ever hears progress, which it cannot merge into a job it has
    // never seen. A gain is a gain whichever window caused it.
    if (!discreet) announceList()
    pump()

    return job
  }

  return {
    submit: (target, label, body) => enqueue(target, label, body, false, null),

    run: (target, label, body) =>
      new Promise<Job>(resolve => void enqueue(target, label, body, true, resolve)),

    resume: stored => {
      let added = false

      for (const remembered of stored) {
        // A job the session already knows is the one that wrote this entry, not a second copy.
        if (entries.has(remembered.id)) continue

        const job: Job = {
          id: remembered.id,
          targetId: remembered.targetId,
          label: remembered.label,
          status: 'queued',
          progress: 0,
          createdAt: remembered.createdAt,
          assetIds: [],
        }

        const entry: Entry = {
          job,
          // Nothing discreet is ever written down, so nothing resumed can be one.
          discreet: false,
          settled: null,
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
        added = true
      }

      // Not a progress event per job: these ids are ones the renderer has never seen, and a
      // replica merges progress into what it already holds. Announced before `pump`, so the
      // first thing said about a resumed job is that it exists.
      if (added) announceList()

      pump()
    },

    cancel: async jobId => {
      const entry = entries.get(jobId)
      if (!entry || isFinished(entry.job.status)) return
      // Asked twice — a double click, two windows on one project — and the first is still in
      // flight: everything up to the API call is synchronous, so the second would find the job
      // gone from the queue, fall through to the running branch, and spend a second cancel on
      // the same job. Whoever is following it will try again from `entry.cancelled` if the API
      // refuses this one.
      if (entry.cancelled) return

      entry.cancelled = true

      // Out of the queue first, so nothing picks it up while the API is being told.
      const position = queue.indexOf(jobId)
      if (position >= 0) {
        queue.splice(position, 1)

        const { account, remoteId } = entry
        // Queued is not the same as never submitted: a job resumed from a previous session waits
        // its turn with a remote id already set. Dropped from the queue alone, it would keep
        // running and being charged for — and `settle` releases the account, so nothing left in
        // the studio could ever cancel it.
        if (account && remoteId) return await abandon(entry, account, remoteId)

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

    list: listed,
  }
}
