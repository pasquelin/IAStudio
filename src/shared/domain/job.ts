import type { JobFailure } from './failure'

export type JobStatus = 'queued' | 'running' | 'succeeded' | 'failed' | 'cancelled'

/**
 * What a job runs. Two endpoints, two vocabularies of id, and one thing that must not be
 * confused: only a model id means anything to the generator, so "regenerate with these
 * parameters" on an asset an App produced would otherwise open the form of a model that does
 * not exist.
 */
export type JobKind = 'model' | 'workflow'

export const JOB_KINDS: readonly JobKind[] = ['model', 'workflow']

/**
 * What to run, and under which vocabulary of id. One shape for the two questions asked of it —
 * what would this cost, and run it — so a third runnable thing is a value here rather than a
 * second channel, a second estimator and a second branch in every caller.
 */
export type JobTarget = { kind: JobKind; id: string }

/** A Scenario job, as the studio sees it. */
export type Job = {
  id: string
  kind: JobKind
  /** The id of whatever `kind` names — a model of the catalogue, or a workflow. */
  targetId: string
  label: string
  status: JobStatus
  /** From 0 to 1. */
  progress: number
  createdAt: string
  finishedAt?: string
  assetIds: string[]
  /** A code, never a message: the renderer translates it — see `domain/failure.ts`. */
  error?: JobFailure
  /**
   * What it cost, in creative units.
   *
   * Read from `creativeUnitsCost` on the submission response, which is the only place the studio
   * has seen it. The typings also declare a `billing.cuCost` on a polled job, unobserved so far —
   * so a job resumed from a previous session simply has no figure rather than a wrong one.
   */
  cost?: number
}

/**
 * What a generation would cost, asked before it is run.
 *
 * `null` where the API declines to say. An estimate is a courtesy: a button with no figure on it
 * is a small disappointment, a button that refuses to work because the price would not come is a
 * broken button.
 */
export type CostEstimate = { creativeUnits: number } | null

/**
 * Requests a minute the studio keeps for what the user is waiting on — a catalogue page, a sheet
 * of thumbnails, a cost estimate.
 *
 * Shared because both sides spend from it and neither can see the other: the main process sizes
 * the poll loop around what is left of it, and the renderer paces its estimates to stay inside
 * it. Written down once, or the two halves drift and the poll loop is the one that pays.
 */
export const INTERACTIVE_REQUESTS_PER_MINUTE = 15

export type JobProgress = Pick<Job, 'id' | 'status' | 'progress'> & {
  assetIds?: string[]
  error?: JobFailure
  cost?: number
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
