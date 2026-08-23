import { create } from 'zustand'
import type { Job, JobProgress, JobTarget } from '@shared/domain/job'
import { connectThroughBridge, getBridge } from '@/services/bridge'
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
  /** Runs what the target names, exactly as the main process does. */
  submit: (target: JobTarget, body: Record<string, unknown>) => Promise<Job | null>
  cancel: (jobId: string) => Promise<void>
  apply: (progress: JobProgress) => void
}

/** Stable, so a surface reading the selector does not re-render on every unrelated job tick. */
const NO_IDS: readonly string[] = []

/**
 * What the most recent finished generation produced — § 24: a result becomes a source without a
 * round trip through the shelf.
 *
 * The LAST one alone, and the list is in submission order: offering everything a session ever
 * made would be a second shelf, and the shelf is one panel away. `assetIds` is what the job
 * carries; the rows themselves are read where they are drawn.
 */
export function latestGenerationIds(state: Pick<JobsState, 'jobs'>): readonly string[] {
  const finished = state.jobs.find(job => job.status === 'succeeded' && job.assetIds?.length)
  return finished?.assetIds ?? NO_IDS
}

/**
 * Jobs are owned by the main process; this replica exists so the jobs bar can render without
 * asking, and it is refreshed by progress events rather than by polling a second time.
 */
export const useJobs = create<JobsState>()((set, get) => ({
  jobs: [],
  bodies: {},

  connect: connectThroughBridge(async bridge => {
    const stopProgress = bridge.provider.onProgress(progress => get().apply(progress))

    // The whole list, because the main process alone knows when it gains or loses an entry: a
    // job picked up from a previous session, and one that left because its project closed. It
    // replaces the array, which `apply` below avoids doing — but only a handful of times in a
    // session, and `JobRow` is keyed by id, so nothing on screen jumps.
    let pushed = false
    const stopChanges = bridge.provider.onJobsChanged(jobs => {
      pushed = true
      set({ jobs })
    })

    try {
      const jobs = await bridge.provider.listJobs()
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
  }),

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

    const job = await bridge.provider.generate(target.id, body)

    set(state => ({ jobs: [job, ...state.jobs], bodies: { ...state.bodies, [job.id]: body } }))
    return job
  },

  cancel: async jobId => {
    await getBridge()?.provider.cancelJob(jobId)
  },
}))
