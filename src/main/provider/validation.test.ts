import { describe, expect, it } from 'vitest'
import { MODEL_PERIODS, MODEL_SORTS } from '@shared/domain/model'
import { parseModelQuery, parseStoredJobs } from './validation'

describe('model query validation', () => {
  /**
   * The schema used to retype the unions by hand, and fell behind: `sort: 'oldest'` reached
   * the menu while the handler still rejected it, surfacing as "an unexpected error".
   */
  it('accepts every sort the panel can offer', () => {
    for (const sort of MODEL_SORTS) {
      expect(parseModelQuery({ sort })).toEqual({ sort })
    }
  })

  it('accepts every period the panel can offer', () => {
    for (const since of MODEL_PERIODS) {
      expect(parseModelQuery({ since })).toEqual({ since })
    }
  })

  it('still refuses a value no facet offers', () => {
    expect(() => parseModelQuery({ sort: 'cheapest' })).toThrow()
  })

  // `limit` sizes the walk the registry performs before answering.
  it('refuses a page size that would freeze the main process', () => {
    expect(() => parseModelQuery({ limit: 10_000 })).toThrow()
  })
})

describe('jobs read back from disk', () => {
  const NOTE = {
    id: 'job_local',
    remoteId: 'job_remote',
    label: 'Flux',
    accountId: 'fingerprint_studio',
    projectPath: '/projects/kingdom',
    createdAt: '2026-08-08T09:00:00.000Z',
  }

  /**
   * A note written by an earlier version names a `modelId` and no kind. Dropped rather than
   * read, it would abandon a generation that is running and has already been paid for.
   */
  it('reads a note an earlier version wrote', () => {
    const [job] = parseStoredJobs(JSON.stringify([{ ...NOTE, modelId: 'model_flux' }]))

    expect(job).toMatchObject({ targetId: 'model_flux' })
  })

  /**
   * A note left by a version that ran more than models carries a `kind` this build has no field
   * for. Read for what it does hold rather than dropped, so a generation already paid for is
   * not abandoned — and the stray field is stripped rather than carried.
   */
  it('reads a note carrying a field this build no longer knows', () => {
    const stored = [{ ...NOTE, kind: 'workflow', targetId: 'job_target' }]

    expect(parseStoredJobs(JSON.stringify(stored))[0]).toEqual({
      ...NOTE,
      targetId: 'job_target',
    })
  })

  // A blank remote id would have the manager poll a job id that is not one.
  it('drops an entry it cannot make sense of, and keeps the rest', () => {
    const stored = [
      { ...NOTE, targetId: 'model_flux', remoteId: '  ' },
      { ...NOTE, modelId: 'm' },
    ]

    expect(parseStoredJobs(JSON.stringify(stored))).toHaveLength(1)
  })

  it('drops a note that names nothing to run', () => {
    expect(parseStoredJobs(JSON.stringify([NOTE]))).toEqual([])
  })
})
