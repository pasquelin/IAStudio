import { describe, expect, it } from 'vitest'
import { FINISHED_STATUSES, isFinished, JOB_STATUSES, type JobStatus } from './job'

/**
 * The bundles are checked against `JOB_STATUSES`, so a status missing from it is a status
 * nobody notices is untranslated. The `Record` is what makes the union say so: adding one
 * without listing it here stops compiling.
 */
describe('the list of job statuses', () => {
  it('holds every status a job can be in', () => {
    const all: Record<JobStatus, true> = {
      queued: true,
      running: true,
      succeeded: true,
      failed: true,
      cancelled: true,
    }

    expect([...JOB_STATUSES].sort()).toEqual(Object.keys(all).sort())
  })

  it('agrees with the shorter list it already had', () => {
    expect(JOB_STATUSES.filter(isFinished)).toEqual(FINISHED_STATUSES)
  })
})
