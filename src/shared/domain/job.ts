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

/** All of them, in the order a job goes through. The jobs panel names each one from a bundle. */
export const JOB_STATUSES: readonly JobStatus[] = [
  'queued',
  'running',
  'succeeded',
  'failed',
  'cancelled',
]

export const FINISHED_STATUSES: readonly JobStatus[] = ['succeeded', 'failed', 'cancelled']

export function isFinished(status: JobStatus): boolean {
  return FINISHED_STATUSES.includes(status)
}

/** What the studio is doing right now. Asked by the status line, the home and its banner. */
export function runningJobs(jobs: readonly Job[]): Job[] {
  return jobs.filter(job => !isFinished(job.status))
}
