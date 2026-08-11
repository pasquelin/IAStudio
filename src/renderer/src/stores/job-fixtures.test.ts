import { describe, expect, it } from 'vitest'
import { isFinished, JOB_STATUSES } from '@shared/domain/job'
import { job } from './job-fixtures'

const FINISHED = JOB_STATUSES.filter(isFinished)
const PENDING = JOB_STATUSES.filter(status => !isFinished(status))
const OUTCOMES = FINISHED.filter(status => status !== 'succeeded')

describe('job fixture', () => {
  it.each(FINISHED)('dates a %s job, as settling one does', status => {
    expect(job({ status }).finishedAt).toBe('2026-08-10T10:00:00.000Z')
  })

  it.each(PENDING)('leaves a %s job undated', status => {
    expect(job({ status }).finishedAt).toBeUndefined()
  })

  it('carries a succeeded job to full progress', () => {
    expect(job({ status: 'succeeded' }).progress).toBe(1)
  })

  /**
   * The default was held by nothing: turned into `queued`, the whole suite stayed green — found by
   * mutation. It is the shape a caller gets by naming no status, and every rule below keys off it:
   * unnamed means still going, undated, at the progress it reached.
   */
  it('is a job still going when no status is named', () => {
    expect(job()).toMatchObject({ status: 'running', progress: 0 })
    // Not in `toMatchObject` above: it reads an absent key and a key set to `undefined` as two
    // different things, and the factory leaves this one absent.
    expect(job().finishedAt).toBeUndefined()
  })

  it.each(OUTCOMES)('leaves a %s job at the progress it reached', status => {
    expect(job({ status, progress: 0.4 }).progress).toBe(0.4)
  })

  it('lets an explicit date win, so a suite can state the shape it needs', () => {
    const stated = job({ status: 'succeeded', finishedAt: '2026-08-11T00:00:00.000Z' })

    expect(stated.finishedAt).toBe('2026-08-11T00:00:00.000Z')
  })

  /** What `apply` leaves behind: a progress event settles a job without ever dating it. */
  it('drops the date when a suite names the key to say it has none', () => {
    expect(job({ status: 'succeeded', finishedAt: undefined }).finishedAt).toBeUndefined()
  })

  it('lets an explicit progress win on a succeeded job', () => {
    expect(job({ status: 'succeeded', progress: 0.9 }).progress).toBe(0.9)
  })

  it('applies the overrides it is given', () => {
    expect(job({ id: 'job_2', label: 'Veo' })).toMatchObject({ id: 'job_2', label: 'Veo' })
  })

  /**
   * A `failed` job the manager published always names its code: `settle` is reached from four
   * places and each passes one. A fixture that omitted it would offer a shape production never
   * holds — and a suite asserting `error === undefined` on it would be green against nothing.
   */
  it('names a failure code on a job that failed', () => {
    expect(job({ status: 'failed' }).error).toBe('rejected')
  })

  it('keeps the code a caller names, rather than its own', () => {
    expect(job({ status: 'failed', error: 'storage' }).error).toBe('storage')
  })

  it('leaves a job that did not fail without a code', () => {
    expect(job({ status: 'succeeded' }).error).toBeUndefined()
  })
})
