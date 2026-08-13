import { create } from 'zustand'
import { isFinished, type Job, type JobProgress, type JobTarget } from '@shared/domain/job'
import { getBridge } from '@/services/bridge'
import { useAssets } from './assets'

type JobsState = {
  jobs: Job[]
  /**
   * What each job was submitted with, kept per session. The catalogue records `jobId` but not
   * the body, so this is what lets the inspector show the prompt behind an asset and offer to
   * run it again. Dropped on reload, like the job list itself.
   */
  bodies: Record<string, Record<string, unknown>>

  /** Loads the current jobs and follows their progress. Returns the unsubscribe function. */
  connect: () => Promise<() => void>
  /** Runs a model or a workflow — the target says which, exactly as it does in the main process. */
  submit: (target: JobTarget, body: Record<string, unknown>) => Promise<Job | null>
  cancel: (jobId: string) => Promise<void>
  apply: (progress: JobProgress) => void
}

/**
 * Jobs are owned by the main process; this replica exists so the jobs bar can render without
 * asking, and it is refreshed by progress events rather than by polling a second time.
 */
export const useJobs = create<JobsState>()((set, get) => ({
  jobs: [],
  bodies: {},

  connect: async () => {
    const bridge = getBridge()
    if (!bridge) return () => {}

    const stopProgress = bridge.scenario.onProgress(progress => get().apply(progress))

    // The whole list, because the main process alone knows when it gains or loses an entry: a
    // job picked up from a previous session, and one that left because its project closed. It
    // replaces the array, which `apply` below avoids doing — but only a handful of times in a
    // session, and `JobRow` is keyed by id, so nothing on screen jumps.
    let pushed = false
    const stopChanges = bridge.scenario.onJobsChanged(jobs => {
      pushed = true
      set({ jobs })
    })

    try {
      const jobs = await bridge.scenario.listJobs()
      // A list announced while the read was in flight is newer than what the read answered —
      // and jobs are picked up at project open, which is exactly when a window is connecting.
      if (!pushed) set({ jobs })
    } catch {
      // The subscriptions still stand: throwing here would strand them with nobody holding the
      // way to remove them.
    }

    return () => {
      stopProgress()
      stopChanges()
    }
  },

  // Merged in place rather than refetching the list: a progress event arrives every couple of
  // seconds per job, and replacing the array would restart every animation in the bar.
  apply: progress => {
    // A job only reaches `succeeded` once its assets are on disk and indexed, so this is the
    // exact moment the browser has something new to show.
    if (progress.status === 'succeeded') useAssets.getState().invalidate()

    set(state => ({
      jobs: state.jobs.map(job =>
        job.id === progress.id
          ? {
              ...job,
              status: progress.status,
              progress: progress.progress,
              assetIds: progress.assetIds ?? job.assetIds,
              ...(progress.error === undefined ? {} : { error: progress.error }),
              ...(progress.cost === undefined ? {} : { cost: progress.cost }),
            }
          : job,
      ),
    }))
  },

  submit: async (target, body) => {
    const bridge = getBridge()
    if (!bridge) return null

    const job = await bridge.scenario.generate(target.id, body)

    set(state => ({ jobs: [job, ...state.jobs], bodies: { ...state.bodies, [job.id]: body } }))
    return job
  },

  cancel: async jobId => {
    await getBridge()?.scenario.cancelJob(jobId)
  },
}))

/**
 * Resolves when a job stops running, whatever it stopped on.
 *
 * What a chain of generations needs and the jobs bar does not: the bar paints every state it is
 * told about, while a graph has to wait on one before it can build the next body.
 *
 * `null` for a job the replica no longer holds. It is not "not yet": `submit` puts the entry in
 * the list before it returns, so a job missing AFTERWARDS is one the main process dropped — a
 * project closed under it, most of the time. Waited on, it would never come back.
 *
 * `signal` gives the wait a way out that does not depend on the job ever ending. Without one, a
 * caller that has given up — a graph run the user stopped — stays parked on this promise for the
 * rest of the session, holding its whole frame: the main process polls an unfinished job with no
 * ceiling, deliberately, so nothing else was ever going to resolve it. Aborted, it answers `null`,
 * which every caller already reads as "no result to use".
 *
 * Required rather than optional, and `null` spelled out where there is genuinely nothing to give
 * up on: optional, the next caller reproduces the parked frame this exists to remove, and nothing
 * mechanical refuses it. The same lock `ToolButton` puts on its tooltip, for the same reason.
 */
export const whenSettled = (jobId: string, signal: AbortSignal | null): Promise<Job | null> =>
  whenJob(jobId, job => isFinished(job.status), signal)

/**
 * Resolves when a job stops waiting, whatever it does next — named for that and not for a start,
 * because a terminal status answers it too and a caller told "started" would believe otherwise.
 *
 * The other half of what a chain of generations needs: submitting is not starting. `queued` covers
 * both waits the studio has — its own concurrency bound (`job-manager.ts` holds the entry at
 * `queued` while it sits in `pump`'s queue) and Scenario's, which `jobStatusOf` maps to the same
 * word — so a caller painting work as under way on submission claims what may not begin for
 * minutes.
 *
 * A terminal status answers this too, and the caller is what decides what to make of it: waiting
 * on a `running` nobody observed would never resolve for a job that finished between two polls,
 * and the wait would then only ever end on the abort.
 *
 * `null` on the same two counts as `whenSettled`: a job the replica no longer holds, and a caller
 * that has given up.
 */
export const whenLeftQueue = (jobId: string, signal: AbortSignal | null): Promise<Job | null> =>
  whenJob(jobId, job => job.status !== 'queued', signal)

function whenJob(
  jobId: string,
  ready: (job: Job) => boolean,
  signal: AbortSignal | null,
): Promise<Job | null> {
  const answer = (jobs: readonly Job[]): Job | null | undefined => {
    const job = jobs.find(candidate => candidate.id === jobId)
    if (!job) return null
    return ready(job) ? job : undefined
  }

  const held = answer(useJobs.getState().jobs)
  if (held !== undefined) return Promise.resolve(held)
  // Asked after the replica, not before: a job that has already stopped HAS an answer, and
  // reporting none would invent an absence. What the caller then does with a run it has given up
  // on is its own business — `executor.ts` drops the values, deliberately and by its own comment.
  if (signal?.aborted) return Promise.resolve(null)

  return new Promise(resolve => {
    // `done` closes over `stop`, assigned below: zustand never calls a subscriber synchronously,
    // so nothing can read it before it exists. Moving the abort listener above the subscription
    // would break that, inside a promise executor, where the ReferenceError has nowhere to go.
    const done = (settled: Job | null): void => {
      stop()
      signal?.removeEventListener('abort', onAbort)
      resolve(settled)
    }

    const onAbort = (): void => done(null)

    const stop = useJobs.subscribe(state => {
      const settled = answer(state.jobs)
      if (settled === undefined) return
      done(settled)
    })

    signal?.addEventListener('abort', onAbort, { once: true })
  })
}
