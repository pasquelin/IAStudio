import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { Job } from '@shared/domain/job'
import { installFakeBridge } from '@/services/fake-bridge'
import { useAssets } from './assets'
import { useJobs, whenSettled } from './jobs'

function job(overrides: Partial<Job> = {}): Job {
  return {
    id: 'job_1',
    kind: 'model',
    targetId: 'model_flux',
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

  it('refreshes the asset browser when a job succeeds, and only then', async () => {
    vi.useFakeTimers()
    installFakeBridge()
    const refresh = vi.fn(() => Promise.resolve())
    useAssets.setState({ refresh })

    useJobs.getState().apply({ id: 'job_1', status: 'running', progress: 0.9 })
    await vi.runAllTimersAsync()
    expect(refresh).not.toHaveBeenCalled()

    useJobs.getState().apply({ id: 'job_1', status: 'succeeded', progress: 1, assetIds: ['a_1'] })
    await vi.runAllTimersAsync()

    expect(refresh).toHaveBeenCalledOnce()
    expect(useJobs.getState().jobs[0]?.assetIds).toEqual(['a_1'])
    vi.useRealTimers()
  })

  /**
   * `apply` can only merge into a job it already holds, so a job the main process picked up from
   * a previous session would never appear and one that stepped aside would spin for ever. The
   * whole list is the only thing that can say either.
   */
  it('takes the list the main process announces when its composition changes', async () => {
    const listeners: ((jobs: Job[]) => void)[] = []
    const stopProgress = vi.fn()
    const stopChanges = vi.fn()
    installFakeBridge({
      scenario: {
        onProgress: () => stopProgress,
        onJobsChanged: callback => {
          listeners.push(callback)
          return stopChanges
        },
      },
    })

    const stop = await useJobs.getState().connect()
    for (const announce of listeners) announce([job({ id: 'job_resumed', label: 'Veo' })])

    expect(useJobs.getState().jobs).toEqual([expect.objectContaining({ id: 'job_resumed' })])

    stop()
    // Both go with the same call, or a closed window keeps receiving events into a dead store.
    expect(stopProgress).toHaveBeenCalledOnce()
    expect(stopChanges).toHaveBeenCalledOnce()
  })

  it('puts a freshly submitted job at the top of the list', async () => {
    installFakeBridge({
      scenario: {
        generate: () => Promise.resolve(job({ id: 'job_new', status: 'queued', progress: 0 })),
      },
    })

    await useJobs.getState().submit({ kind: 'model', id: 'model_flux' }, { prompt: 'a rock' })
    expect(useJobs.getState().jobs[0]?.id).toBe('job_new')
  })
})

describe('waiting on a job', () => {
  beforeEach(() => {
    useJobs.setState({ jobs: [job({ id: 'job_1' })] })
  })

  it('answers straight away for one that has already stopped', async () => {
    useJobs.setState({ jobs: [job({ id: 'job_1', status: 'succeeded', assetIds: ['asset_1'] })] })

    await expect(whenSettled('job_1')).resolves.toMatchObject({ assetIds: ['asset_1'] })
  })

  it('waits for the progress that stops it, and ignores the ones that do not', async () => {
    const settled = whenSettled('job_1')

    useJobs.getState().apply({ id: 'job_1', status: 'running', progress: 0.5 })
    useJobs.getState().apply({ id: 'job_1', status: 'failed', progress: 0.5, error: 'server' })

    await expect(settled).resolves.toMatchObject({ status: 'failed' })
  })

  it('answers nothing for a job the replica no longer holds, rather than waiting for ever', async () => {
    const settled = whenSettled('job_1')
    // What a project closed under a running job leaves behind: the main process drops the entry
    // and announces the list without it. Waited on, this one would never come back.
    useJobs.setState({ jobs: [] })

    await expect(settled).resolves.toBeNull()
  })
})
