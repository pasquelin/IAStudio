import type { JobFailure } from './failure'

export type JobStatus = 'queued' | 'running' | 'succeeded' | 'failed' | 'cancelled'

/**
 * What to run. One shape for the two questions asked of it — what would this cost, and run it —
 * so a second runnable thing is a value here rather than a second channel, a second estimator
 * and a second branch in every caller.
 */
export type JobTarget = { id: string }

/** A Scenario job, as the studio sees it. */
export type Job = {
  id: string
  /** The model of the catalogue this job runs. */
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
   * What it cost, in the unit `costUnit` names.
   *
   * Read from `creativeUnitsCost` beside a submission, and from `billing.cuCost` on the job
   * itself — which is where a job resumed from a previous session can still find it.
   */
  cost?: number
  /**
   * The unit the figure above is quoted in. ABSENT means Scenario's creative units, which every
   * job carried before a second cloud arrived — and nothing on disk has to be rewritten for it.
   *
   * 🛑 Two clouds, two counters, and nothing is ever added across them: a Tripo credit is not a
   * creative unit and no rate anywhere converts one into the other.
   */
  costUnit?: string
  /**
   * Whether the service running it takes a cancellation at all. Absent means yes, which every
   * job carried before a second cloud arrived.
   *
   * 🛑 A property of the SERVICE, decided where the runners live: read off the target by the
   * window instead, a row would carry a rule of the main process and name a cloud to apply it.
   */
  cancellable?: boolean
  /**
   * The id the runner issued. Ours (`id`) is minted before submit; a local runner files what it
   * produced under this one (`local_…`). Absent until submit has answered.
   */
  remoteId?: string
  /**
   * What a generation that writes no file answered — the script a code model wrote.
   *
   * 🛑 Not an asset, and deliberately: a script is a DOCUMENT of the project, so it lands in an
   * editor rather than on the shelf, and the window is what puts it there.
   */
  text?: string
  /**
   * A sentence a runner wants said on the job's own row — a free rig check's verdict, today.
   *
   * 🛑 Never `text`: that one is a DOCUMENT, and the Code space lands it in an editor for any
   * claimed job — a verdict written there would overwrite the script open in the tab.
   */
  note?: JobNote
}

/** What a runner says on a row, as `JobFailure` does: a KEY, never a message. */
export type JobNote = {
  readonly labelKey: string
  /** The holes of the sentence, and their values are KEYS too — the row translates each. */
  readonly params?: Readonly<Record<string, string>>
  /** Absent reads as a plain fact; `warning` is what should stop a spend. */
  readonly tone?: 'warning'
}

/** The runner's own id (`local_…`). Collecting under ours files nothing and still succeeds. */
export function runnerIdOf(job: Job): string {
  return job.remoteId ?? job.id
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
  costUnit?: string
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

/**
 * What reaching a status writes on a job besides the status itself: a terminal one dates it, and
 * a succeeded one is complete by definition. Nothing at all while it is still running.
 *
 * Here rather than in either caller, and beside `isFinished` for the same reason it is: the
 * manager settles the real job and the fixture stands for one, and the day the two disagree a
 * suite affirms a shape the studio never publishes. They HAD disagreed, and nothing held the pair.
 *
 * What is shared is the RULE, never the date: the manager reads the clock and the fixture hands
 * its `createdAt`, which is deliberate — a fixture that read a clock would not be one. A fixture's
 * `finishedAt` is therefore still no prediction of a real job's.
 *
 * The two shapes are spelled out rather than left to `Partial`, which would let a progress with no
 * date past the compiler and leave the rule resting on the tests alone.
 */
export function settlementOf(
  status: JobStatus,
  at: string,
): Record<string, never> | { finishedAt: string; progress?: number } {
  if (!isFinished(status)) return {}

  return status === 'succeeded' ? { finishedAt: at, progress: 1 } : { finishedAt: at }
}

/** What the studio is doing right now. Asked by the status line, the home and its banner. */
export function runningJobs(jobs: readonly Job[]): Job[] {
  return jobs.filter(job => !isFinished(job.status))
}
