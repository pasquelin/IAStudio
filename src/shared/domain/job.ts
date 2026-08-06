export type JobStatus = 'queued' | 'running' | 'succeeded' | 'failed' | 'cancelled'

/** Un job Scenario, vu par le studio. */
export type Job = {
  id: string
  modelId: string
  label: string
  status: JobStatus
  /** De 0 à 1. */
  progress: number
  createdAt: string
  finishedAt?: string
  assetIds: string[]
  error?: string
}

export type JobProgress = Pick<Job, 'id' | 'status' | 'progress'> & {
  assetIds?: string[]
  error?: string
}

export const FINISHED_STATUSES: readonly JobStatus[] = ['succeeded', 'failed', 'cancelled']

export function isFinished(status: JobStatus): boolean {
  return FINISHED_STATUSES.includes(status)
}
