import type { JobFailure } from '@shared/domain/failure'
import { type Job, settlementOf } from '@shared/domain/job'

/** What `settle` writes when the API turned a generation down — the commonest of its four codes. */
const DEFAULT_FAILURE: JobFailure = 'rejected'

const RUNNING: Job = {
  id: 'job_1',
  kind: 'model',
  targetId: 'model_flux',
  label: 'Flux',
  status: 'running',
  progress: 0,
  createdAt: '2026-08-10T10:00:00.000Z',
  assetIds: [],
}

/**
 * A job as the main process announces it — the list it publishes, not the progress events it
 * sends. The suites that each built their own invented a third thing the studio never holds: a
 * terminal status with no `finishedAt`, and a succeeded one short of full progress. `settle` in
 * `job-manager.ts` writes both, and `job-manager.test.ts` holds it to that.
 *
 * Naming a key is what opts out, `undefined` included — `apply` (`jobs.ts`) merges a progress
 * event without ever dating it, so a job settled that way is the store's other real shape and
 * has to stay sayable. Spreading a whole job in names every key at once and so opts out of both:
 * settle it with `job({ id: previous.id, status: 'succeeded' })` rather than from its spread.
 */
export function job(overrides: Partial<Job> = {}): Job {
  const built: Job = { ...RUNNING, ...overrides }

  // A failed job always carries its code: `settle` is reached from four places and every one of
  // them names one. Without it, the fixture would offer a shape the manager never publishes —
  // which is the class of lie this factory exists to end.
  const failed = built.status === 'failed' && !('error' in overrides)

  return {
    ...built,
    // The manager's own rule, asked rather than copied: a second spelling of it here is exactly
    // how this pair drifted before. `createdAt` stands in for the clock the manager reads, and a
    // job still running settles to nothing — no guard of this file's own for that.
    ...settlementOf(built.status, built.createdAt),
    // The opt-out, said once: putting the named keys back covers whatever the rule wrote, so a
    // third key added to it stays escapable without this line knowing the list.
    ...overrides,
    ...(failed ? { error: DEFAULT_FAILURE } : {}),
  }
}
