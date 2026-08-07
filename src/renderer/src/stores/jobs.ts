import { create } from 'zustand'
import type { Job, JobProgress } from '@shared/domain/job'
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
  submit: (modelId: string, body: Record<string, unknown>) => Promise<Job | null>
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

    const stop = bridge.scenario.onProgress(progress => get().apply(progress))
    set({ jobs: await bridge.scenario.listJobs() })
    return stop
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
            }
          : job,
      ),
    }))
  },

  submit: async (modelId, body) => {
    const bridge = getBridge()
    if (!bridge) return null

    const job = await bridge.scenario.generate(modelId, body)
    set(state => ({ jobs: [job, ...state.jobs], bodies: { ...state.bodies, [job.id]: body } }))
    return job
  },

  cancel: async jobId => {
    await getBridge()?.scenario.cancelJob(jobId)
  },
}))
