import { APIError } from '@scenario-labs/sdk'
import { describe, expect, it, vi } from 'vitest'
import type { JobProgress } from '@shared/domain/job'
import {
  createJobManager,
  jobStatusOf,
  type JobManager,
  type JobManagerDeps,
  type RemoteJob,
} from './job-manager'

const settled = (): Promise<void> => new Promise(resolve => setImmediate(resolve))

function remote(status: string, overrides: Partial<RemoteJob> = {}): RemoteJob {
  return { jobId: 'job_remote', status, progress: 0, ...overrides }
}

type Harness = {
  manager: JobManager
  progress: JobProgress[]
  sleeps: number[]
}

function harness(overrides: Partial<JobManagerDeps> = {}): Harness {
  const progress: JobProgress[] = []
  const sleeps: number[] = []
  let sequence = 0

  const manager = createJobManager({
    runner: {
      submit: () => Promise.resolve(remote('success')),
      poll: () => Promise.resolve(remote('success')),
      cancel: () => Promise.resolve(),
    },
    collect: () => Promise.resolve([]),
    concurrency: () => 2,
    maxRetries: () => 3,
    onProgress: entry => void progress.push(structuredClone(entry)),
    now: () => `2026-08-06T10:00:${String(sequence++).padStart(2, '0')}.000Z`,
    newId: () => `job_${sequence}`,
    // Delays are recorded rather than waited: the backoff schedule is what matters, and a
    // test that actually sleeps for it takes seconds to prove one assertion.
    sleep: ms => {
      sleeps.push(ms)
      return Promise.resolve()
    },
    ...overrides,
  })

  return { manager, progress, sleeps }
}

describe('status mapping', () => {
  it('folds the eight statuses of the API onto the five of the studio', () => {
    expect(jobStatusOf('pending')).toBe('queued')
    expect(jobStatusOf('queued')).toBe('queued')
    expect(jobStatusOf('warming-up')).toBe('running')
    expect(jobStatusOf('in-progress')).toBe('running')
    expect(jobStatusOf('finalizing')).toBe('running')
    expect(jobStatusOf('success')).toBe('succeeded')
    expect(jobStatusOf('failure')).toBe('failed')
    expect(jobStatusOf('canceled')).toBe('cancelled')
  })

  // Declaring an outcome nobody understood is worse than polling one cycle too many.
  it('keeps polling on a status it has never seen', () => {
    expect(jobStatusOf('reticulating-splines')).toBe('running')
  })
})

describe('job manager', () => {
  it('reports the job as queued the moment it is submitted', () => {
    const { manager } = harness()
    const job = manager.submit('model_flux', 'Flux', { prompt: 'a rock' })

    expect(job).toMatchObject({
      modelId: 'model_flux',
      label: 'Flux',
      status: 'queued',
      progress: 0,
    })
  })

  it('never runs more jobs at once than it is allowed to', async () => {
    let active = 0
    let peak = 0
    const release: (() => void)[] = []

    const { manager } = harness({
      concurrency: () => 2,
      runner: {
        submit: () => {
          active++
          peak = Math.max(peak, active)
          return new Promise(resolve =>
            release.push(() => {
              active--
              resolve(remote('success'))
            }),
          )
        },
        poll: () => Promise.resolve(remote('success')),
        cancel: () => Promise.resolve(),
      },
    })

    for (let index = 0; index < 6; index++) manager.submit('model_flux', 'Flux', {})
    await settled()

    expect(peak).toBe(2)

    while (release.length > 0) {
      release.shift()?.()
      await settled()
    }

    expect(manager.list().every(job => job.status === 'succeeded')).toBe(true)
    expect(peak).toBe(2)
  })

  it('follows the progress the API reports', async () => {
    const statuses = [remote('queued', { progress: 0 }), remote('in-progress', { progress: 0.4 })]
    const { manager, progress } = harness({
      runner: {
        submit: () => Promise.resolve(remote('queued', { progress: 0 })),
        poll: () => Promise.resolve(statuses.shift() ?? remote('success', { progress: 1 })),
        cancel: () => Promise.resolve(),
      },
    })

    manager.submit('model_flux', 'Flux', {})
    await settled()

    expect(progress.map(entry => [entry.status, entry.progress])).toEqual([
      ['queued', 0],
      ['running', 0.4],
      ['succeeded', 1],
    ])
  })

  it('retries a rate limit with a growing delay', async () => {
    let attempts = 0
    const { manager, sleeps } = harness({
      maxRetries: () => 3,
      runner: {
        submit: () => {
          attempts++
          return attempts < 3
            ? Promise.reject(APIError.generate(429, undefined, undefined, new Headers()))
            : Promise.resolve(remote('success'))
        },
        poll: () => Promise.resolve(remote('success')),
        cancel: () => Promise.resolve(),
      },
    })

    manager.submit('model_flux', 'Flux', {})
    await settled()

    expect(sleeps).toEqual([1000, 2000])
    expect(manager.list()[0]?.status).toBe('succeeded')
  })

  it('gives up on an error a retry cannot fix', async () => {
    const submit = vi.fn(() =>
      Promise.reject(APIError.generate(400, undefined, 'bad body', new Headers())),
    )
    const { manager } = harness({
      runner: { submit, poll: () => Promise.resolve(remote('success')), cancel: vi.fn() },
    })

    manager.submit('model_flux', 'Flux', {})
    await settled()

    expect(submit).toHaveBeenCalledOnce()
    expect(manager.list()[0]).toMatchObject({ status: 'failed' })
  })

  it('drops a queued job without ever reaching the API', async () => {
    const submit = vi.fn(() => new Promise<RemoteJob>(() => {}))
    const cancel = vi.fn(() => Promise.resolve())
    const { manager } = harness({
      concurrency: () => 1,
      runner: { submit, poll: () => Promise.resolve(remote('success')), cancel },
    })

    manager.submit('model_flux', 'Flux', {})
    const queued = manager.submit('model_flux', 'Flux', {})
    await manager.cancel(queued.id)

    expect(submit).toHaveBeenCalledOnce()
    expect(cancel).not.toHaveBeenCalled()
    expect(manager.list().find(job => job.id === queued.id)?.status).toBe('cancelled')
  })

  it('tells the API about a job it has already started', async () => {
    const cancel = vi.fn(() => Promise.resolve())
    const { manager } = harness({
      runner: {
        submit: () => Promise.resolve(remote('in-progress')),
        poll: () => new Promise<RemoteJob>(() => {}),
        cancel,
      },
    })

    const job = manager.submit('model_flux', 'Flux', {})
    await settled()
    await manager.cancel(job.id)

    expect(cancel).toHaveBeenCalledWith('job_remote')
  })

  it('succeeds only once the assets are indexed', async () => {
    const order: string[] = []
    const { manager, progress } = harness({
      runner: {
        submit: () => Promise.resolve(remote('success', { metadata: { assetIds: ['remote_1'] } })),
        poll: () => Promise.resolve(remote('success')),
        cancel: () => Promise.resolve(),
      },
      collect: (_job, remoteAssetIds) => {
        order.push(`collect:${remoteAssetIds.join(',')}`)
        return Promise.resolve(['asset_local'])
      },
      onProgress: entry => void order.push(`progress:${entry.status}`),
    })

    manager.submit('model_flux', 'Flux', {})
    await settled()

    expect(order).toEqual(['progress:queued', 'collect:remote_1', 'progress:succeeded'])
    expect(manager.list()[0]?.assetIds).toEqual(['asset_local'])
    expect(progress).toEqual([])
  })

  it('fails the job when its assets cannot be brought down', async () => {
    const { manager } = harness({
      collect: () => Promise.reject(new Error('disk full')),
    })

    manager.submit('model_flux', 'Flux', {})
    await settled()

    expect(manager.list()[0]).toMatchObject({ status: 'failed', error: 'disk full' })
  })

  it('lists the most recent job first', async () => {
    const { manager } = harness()
    manager.submit('model_flux', 'Flux', {})
    const second = manager.submit('model_veo', 'Veo', {})
    await settled()

    expect(manager.list()[0]?.id).toBe(second.id)
  })
})
