import { APIError } from '@scenario-labs/sdk'
import { describe, expect, it, vi } from 'vitest'
import type { JobProgress } from '@shared/domain/job'
import {
  createJobManager,
  jobStatusOf,
  type AssetCollector,
  type JobManager,
  type JobManagerDeps,
  type JobRunner,
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

/** The two halves of a `JobAccount`, spelled apart because most tests only replace one. */
type HarnessOptions = Partial<JobManagerDeps> & {
  runner?: JobRunner
  collect?: AssetCollector
}

function harness({ runner, collect, ...overrides }: HarnessOptions = {}): Harness {
  const progress: JobProgress[] = []
  const sleeps: number[] = []
  let sequence = 0

  const manager = createJobManager({
    account: () => ({
      runner: runner ?? {
        submit: () => Promise.resolve(remote('success')),
        poll: () => Promise.resolve(remote('success')),
        cancel: () => Promise.resolve(),
      },
      collect: collect ?? (() => Promise.resolve([])),
    }),
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

  // A local write failure is not what the API said, and neither is a code the renderer can
  // mistake for an API problem.
  it('fails the job on a storage code when its assets cannot be brought down', async () => {
    const { manager } = harness({
      collect: () => Promise.reject(new Error('disk full')),
    })

    manager.submit('model_flux', 'Flux', {})
    await settled()

    expect(manager.list()[0]).toMatchObject({ status: 'failed', error: 'storage' })
  })

  it('reduces an API error to a code rather than carrying its message across', async () => {
    const leaky = APIError.generate(500, undefined, 'Authorization: Basic c2VjcmV0', new Headers())
    const { manager } = harness({
      maxRetries: () => 0,
      runner: {
        submit: () => Promise.reject(leaky),
        poll: () => Promise.resolve(remote('success')),
        cancel: () => Promise.resolve(),
      },
    })

    manager.submit('model_flux', 'Flux', {})
    await settled()

    const failed = manager.list()[0]
    expect(failed).toMatchObject({ status: 'failed', error: 'server' })
    expect(JSON.stringify(failed)).not.toContain('c2VjcmV0')
  })

  it('reports a job the API rejected as rejected, not as an unknown failure', async () => {
    const { manager } = harness({
      runner: {
        submit: () => Promise.resolve(remote('failure')),
        poll: () => Promise.resolve(remote('failure')),
        cancel: () => Promise.resolve(),
      },
    })

    manager.submit('model_flux', 'Flux', {})
    await settled()

    expect(manager.list()[0]).toMatchObject({ status: 'failed', error: 'rejected' })
  })

  it('lists the most recent job first', async () => {
    const { manager } = harness()
    manager.submit('model_flux', 'Flux', {})
    const second = manager.submit('model_veo', 'Veo', {})
    await settled()

    expect(manager.list()[0]?.id).toBe(second.id)
  })
})

/**
 * A job id belongs to the account that created it. Asking the next account about it answers
 * 404, which no retry can fix — so a ten-minute video generation used to die on a switch that
 * had nothing to do with it.
 */
describe('the account a job runs on', () => {
  /**
   * The studio account, the one switched to mid-generation, and the switch itself. The default
   * poll answers once as running — which is what flips the account — then succeeds.
   */
  function switching(studioPoll?: JobRunner['poll']) {
    const other = { runner: { submit: vi.fn(), poll: vi.fn(), cancel: vi.fn() }, collect: vi.fn() }
    let switched = false

    const defaultPoll = (jobId: string): Promise<RemoteJob> => {
      if (switched) {
        return Promise.resolve(remote('success', { jobId, metadata: { assetIds: ['r_1'] } }))
      }
      // The user switches accounts while the generation is still running.
      switched = true
      return Promise.resolve(remote('in-progress', { jobId }))
    }

    const studio = {
      runner: {
        submit: () => Promise.resolve(remote('in-progress')),
        poll: vi.fn(studioPoll ?? defaultPoll),
        cancel: vi.fn(() => Promise.resolve()),
      },
      collect: vi.fn(() => Promise.resolve(['asset_local'])),
    }

    const { manager } = harness({ account: () => (switched ? other : studio) })
    return { manager, studio, other, switch: () => void (switched = true) }
  }

  it('polls the account that submitted it, not the one active when the poll comes round', async () => {
    const { manager, studio, other } = switching()

    manager.submit('model_veo', 'Veo', {})
    await settled()

    expect(studio.runner.poll).toHaveBeenCalledTimes(2)
    expect(other.runner.poll).not.toHaveBeenCalled()
    expect(manager.list()[0]).toMatchObject({ status: 'succeeded', assetIds: ['asset_local'] })
  })

  // The output is retrieved with the same key that generated it — a signed URL from the other
  // account's client answers 404, which the collector reports as a local storage failure.
  it('collects the outputs on that same account', async () => {
    const { manager, studio, other } = switching()

    manager.submit('model_veo', 'Veo', {})
    await settled()

    expect(studio.collect).toHaveBeenCalledOnce()
    expect(other.collect).not.toHaveBeenCalled()
  })

  it('cancels on that same account', async () => {
    const {
      manager,
      studio,
      other,
      switch: switchAccount,
    } = switching(() => new Promise<RemoteJob>(() => {}))

    const job = manager.submit('model_veo', 'Veo', {})
    await settled()
    switchAccount()
    await manager.cancel(job.id)

    expect(studio.runner.cancel).toHaveBeenCalledWith('job_remote')
    expect(other.runner.cancel).not.toHaveBeenCalled()
  })

  it('fails a job submitted without a key rather than borrowing one added since', async () => {
    const { manager } = harness({ account: () => null })

    manager.submit('model_flux', 'Flux', {})
    await settled()

    expect(manager.list()[0]).toMatchObject({ status: 'failed', error: 'missing' })
  })
})
