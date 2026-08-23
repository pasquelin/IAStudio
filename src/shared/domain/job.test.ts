import { describe, expect, it } from 'vitest'
import {
  FINISHED_STATUSES,
  isFinished,
  JOB_STATUSES,
  runnerIdOf,
  type Job,
  type JobStatus,
  settlementOf,
} from './job'

const AT = '2026-08-12T10:00:00.000Z'

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

/**
 * The rule the manager writes onto a real job and the fixture onto the one it stands for. Held
 * here, on the one function both ask, rather than twice on either side of the boundary.
 */
describe('what reaching a status writes on a job', () => {
  it('dates every terminal status', () => {
    for (const status of FINISHED_STATUSES) {
      expect(settlementOf(status, AT).finishedAt).toBe(AT)
    }
  })

  it('brings a succeeded job to full progress', () => {
    expect(settlementOf('succeeded', AT)).toEqual({ finishedAt: AT, progress: 1 })
  })

  /**
   * A job that failed halfway kept the figure it had reached, and that is what the bar draws. A
   * blanket "terminal means complete" would round every failure up to a full bar.
   */
  it('says nothing about the progress of a job that did not succeed', () => {
    for (const status of FINISHED_STATUSES.filter(other => other !== 'succeeded')) {
      expect(settlementOf(status, AT)).toEqual({ finishedAt: AT })
    }
  })

  // Dating a job still in flight would make `runningJobs` and the bar disagree about it.
  it('writes nothing at all while the job is still running', () => {
    for (const status of JOB_STATUSES.filter(other => !isFinished(other))) {
      expect(settlementOf(status, AT)).toEqual({})
    }
  })
})

const JOB: Job = {
  id: 'job_1',
  targetId: 'sana-600m-1024',
  label: 'Sana',
  status: 'running',
  progress: 1,
  createdAt: AT,
  assetIds: [],
}

describe('the id the runner knows a job by', () => {
  it("is the runner's own once submit has answered", () => {
    expect(runnerIdOf({ ...JOB, remoteId: 'local_abc' })).toBe('local_abc')
  })

  it('falls back to ours before submit has answered', () => {
    expect(runnerIdOf(JOB)).toBe('job_1')
  })
})
