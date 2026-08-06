import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { Job } from '@shared/domain/job'
import { installFakeBridge } from '@/services/fake-bridge'
import { useAssets } from './assets'
import { useJobs } from './jobs'

function job(overrides: Partial<Job> = {}): Job {
  return {
    id: 'job_1',
    modelId: 'model_flux',
    label: 'Flux',
    status: 'running',
    progress: 0.2,
    createdAt: '2026-08-06T10:00:00.000Z',
    assetIds: [],
    ...overrides,
  }
}

describe('jobs store', () => {
  beforeEach(() => {
    useJobs.setState({ jobs: [job({ id: 'job_1' }), job({ id: 'job_2' })] })
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('updates a job in place without touching the others', () => {
    const before = useJobs.getState().jobs[1]
    useJobs.getState().apply({ id: 'job_1', status: 'running', progress: 0.6 })

    const [first, second] = useJobs.getState().jobs
    expect(first?.progress).toBe(0.6)
    expect(first?.label).toBe('Flux')
    // Identity matters: replacing the array would restart every animation in the bar.
    expect(second).toBe(before)
  })

  it('ignores progress for a job it does not know', () => {
    useJobs.getState().apply({ id: 'job_unknown', status: 'succeeded', progress: 1 })
    expect(useJobs.getState().jobs).toHaveLength(2)
  })

  it('carries the assets and the error a progress reports', () => {
    useJobs
      .getState()
      .apply({ id: 'job_1', status: 'failed', progress: 0.2, error: 'rate-limited' })

    expect(useJobs.getState().jobs[0]).toMatchObject({
      status: 'failed',
      error: 'rate-limited',
    })
  })

  it('refreshes the asset browser when a job succeeds, and only then', () => {
    installFakeBridge()
    const refresh = vi.fn(() => Promise.resolve())
    useAssets.setState({ refresh })

    useJobs.getState().apply({ id: 'job_1', status: 'running', progress: 0.9 })
    expect(refresh).not.toHaveBeenCalled()

    useJobs.getState().apply({ id: 'job_1', status: 'succeeded', progress: 1, assetIds: ['a_1'] })
    expect(refresh).toHaveBeenCalledOnce()
    expect(useJobs.getState().jobs[0]?.assetIds).toEqual(['a_1'])
  })

  it('puts a freshly submitted job at the top of the list', async () => {
    installFakeBridge({
      scenario: {
        generate: () => Promise.resolve(job({ id: 'job_new', status: 'queued', progress: 0 })),
      },
    })

    await useJobs.getState().submit('model_flux', { prompt: 'a rock' })
    expect(useJobs.getState().jobs[0]?.id).toBe('job_new')
  })
})
