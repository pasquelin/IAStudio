import type { JobFailure } from './failure'

export type JobStatus = 'queued' | 'running' | 'succeeded' | 'failed' | 'cancelled'

/** A Scenario job, as the studio sees it. */
export type Job = {
  id: string
  modelId: string
  label: string
  status: JobStatus
  /** From 0 to 1. */
  progress: number
  createdAt: string
  finishedAt?: string
  assetIds: string[]
  /** A code, never a message: the renderer translates it — see `domain/failure.ts`. */
  error?: JobFailure
}

export type JobProgress = Pick<Job, 'id' | 'status' | 'progress'> & {
  assetIds?: string[]
  error?: JobFailure
}

export const FINISHED_STATUSES: readonly JobStatus[] = ['succeeded', 'failed', 'cancelled']

export function isFinished(status: JobStatus): boolean {
  return FINISHED_STATUSES.includes(status)
}
