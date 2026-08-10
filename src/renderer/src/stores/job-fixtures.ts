import { isFinished, type Job } from '@shared/domain/job'

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
 * A job as the main process announces it, settled ones included.
 *
 * The four suites that each built their own invented a job the manager never announces: a
 * terminal status with no `finishedAt`, and a succeeded one short of full progress. `settle` in
 * `job-manager.ts` writes both, so this writes both.
 *
 * Naming a key is what opts out, `undefined` included — `apply` merges a progress event without
 * a date, so a job settled that way is a real shape of the store and has to stay sayable.
 */
export function job(overrides: Partial<Job> = {}): Job {
  const built: Job = { ...RUNNING, ...overrides }
  if (!isFinished(built.status)) return built

  const completes = built.status === 'succeeded' && !('progress' in overrides)

  return {
    ...built,
    finishedAt: 'finishedAt' in overrides ? overrides.finishedAt : built.createdAt,
    progress: completes ? 1 : built.progress,
  }
}
