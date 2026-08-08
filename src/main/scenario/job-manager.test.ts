import { APIConnectionError, APIError } from '@scenario-labs/sdk'
import { describe, expect, it, vi } from 'vitest'
import type { Job, JobProgress } from '@shared/domain/job'
import type { ActivityReport } from '@main/project/activity-log'
import {
  createJobManager,
  jobProgressOf,
  jobStatusOf,
  POLL_REQUESTS_PER_MINUTE,
  type AssetCollector,
  type JobManager,
  type JobManagerDeps,
  type JobRunner,
  type RemoteJob,
} from './job-manager'
import type { PersistedJob } from './job-store'

const settled = (): Promise<void> => new Promise(resolve => setImmediate(resolve))

/**
 * Counted across the whole harness rather than per job, so it has to clear the busiest test by
 * a wide margin — a runaway loop reaches it in milliseconds either way.
 */
const RUNAWAY_SLEEPS = 1000

function remote(status: string, overrides: Partial<RemoteJob> = {}): RemoteJob {
  return { jobId: 'job_remote', status, progress: 0, ...overrides }
}

/** A note a previous session left behind: the job exists at the API and has been paid for. */
const RUNNING: PersistedJob = {
  id: 'job_left_running',
  remoteId: 'job_remote',
  modelId: 'model_veo',
  label: 'Veo',
  accountId: 'fingerprint_studio',
  projectPath: '/projects/kingdom',
  createdAt: '2026-08-06T09:00:00.000Z',
}

type Harness = {
  manager: JobManager
  progress: JobProgress[]
  sleeps: number[]
  recorded: ActivityReport[]
  /** Every list the manager announced, in order. One entry per gain or loss, never per poll. */
  announced: (readonly Job[])[]
  /**
   * What would survive the process, as of now. A function and not a value: `persist` replaces
   * the list rather than mutating it, and a destructured getter would freeze the empty one the
   * harness starts with — which is what made two of these tests assert nothing at all.
   */
  remembered: () => PersistedJob[]
}

/** The two halves of a `JobAccount`, spelled apart because most tests only replace one. */
type HarnessOptions = Partial<JobManagerDeps> & {
  /** Partial, because a test about the queue never reaches `submit` or `poll` at all. */
  runner?: Partial<JobRunner>
  collect?: AssetCollector
}

function harness({ runner, collect, ...overrides }: HarnessOptions = {}): Harness {
  const progress: JobProgress[] = []
  const sleeps: number[] = []
  const recorded: ActivityReport[] = []
  const announced: (readonly Job[])[] = []
  let remembered: PersistedJob[] = []
  let sequence = 0

  const account = {
    runner: {
      submit: () => Promise.resolve(remote('success')),
      poll: () => Promise.resolve(remote('success')),
      cancel: () => Promise.resolve(),
      ...runner,
    },
    collect: collect ?? (() => Promise.resolve([])),
  }

  const manager = createJobManager({
    accounts: { active: () => ({ id: 'fingerprint_studio', account }), of: () => account },
    projectPath: () => '/projects/kingdom',
    persist: jobs => void (remembered = [...jobs]),
    concurrency: () => 2,
    maxRetries: () => 3,
    onProgress: entry => void progress.push(structuredClone(entry)),
    onListChanged: list => void announced.push(structuredClone(list)),
    record: report => void recorded.push(report),
    now: () => `2026-08-06T10:00:${String(sequence++).padStart(2, '0')}.000Z`,
    newId: () => `job_${sequence}`,
    // Delays are recorded rather than waited: the backoff schedule is what matters, and a
    // test that actually sleeps for it takes seconds to prove one assertion.
    // Bounded, because these delays resolve on the microtask queue: a poll loop whose exit
    // condition regresses would spin without ever letting a timer — vitest's own included —
    // fire, turning a red assertion into a run that has to be killed by hand. Thrown outside
    // the promise chain as well, because `execute` catches everything: swallowed, the guard
    // would settle the job as failed and let a spinning loop merge green.
    sleep: ms => {
      sleeps.push(ms)
      if (sleeps.length > RUNAWAY_SLEEPS) {
        const runaway = new Error('poll loop did not terminate')
        queueMicrotask(() => {
          throw runaway
        })
        throw runaway
      }
      return Promise.resolve()
    },
    ...overrides,
  })

  return { manager, progress, sleeps, recorded, announced, remembered: () => remembered }
}

describe('status mapping', () => {
  it('folds the eight statuses of generation onto the five of the studio', () => {
    expect(jobStatusOf('pending')).toBe('queued')
    expect(jobStatusOf('queued')).toBe('queued')
    expect(jobStatusOf('warming-up')).toBe('running')
    expect(jobStatusOf('in-progress')).toBe('running')
    expect(jobStatusOf('finalizing')).toBe('running')
    expect(jobStatusOf('success')).toBe('succeeded')
    expect(jobStatusOf('failure')).toBe('failed')
    expect(jobStatusOf('canceled')).toBe('cancelled')
  })

  // Unrecognised, either would fold onto `running` and poll for ever holding a concurrency slot.
  it('folds the two outcomes the guide spells differently for a workflow job', () => {
    expect(jobStatusOf('succeeded')).toBe('succeeded')
    expect(jobStatusOf('failed')).toBe('failed')
  })

  // Declaring an outcome nobody understood is worse than polling one cycle too many.
  it('keeps polling on a status it has never seen', () => {
    expect(jobStatusOf('reticulating-splines')).toBe('running')
  })
})

describe('progress normalisation', () => {
  it('leaves the fraction the SDK types promise alone', () => {
    expect(jobProgressOf(0)).toBe(0)
    expect(jobProgressOf(0.42)).toBe(0.42)
    expect(jobProgressOf(1)).toBe(1)
  })

  // Passed on as-is, the 0 to 100 the guide describes would show as 10000 % in the jobs bar.
  it('reads a reading past the fraction scale as a percentage', () => {
    expect(jobProgressOf(100)).toBe(1)
    expect(jobProgressOf(40)).toBe(0.4)
  })

  // The scale a generation ends on: `ProgressBar` clamps 1.02 rather than divide it by a hundred.
  it('reads a generation overshooting its own scale as finished, not as one percent', () => {
    expect(jobProgressOf(1.02)).toBe(1)
    expect(jobProgressOf(2)).toBe(1)
  })

  it('never reports outside the fraction it promises', () => {
    expect(jobProgressOf(150)).toBe(1)
    expect(jobProgressOf(-1)).toBe(0)
    expect(jobProgressOf(Number.NaN)).toBe(0)
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

  /**
   * The percentages have to land on a poll that is still running: `advance` returns before
   * storing anything once the status is final, and `settle` writes 1 of its own accord.
   */
  it('finishes a job that spells its outcome and its progress the way the guide does', async () => {
    const polls = [remote('in-progress', { progress: 40 }), remote('finalizing', { progress: 100 })]
    const { manager, progress } = harness({
      runner: {
        submit: () => Promise.resolve(remote('queued', { progress: 0 })),
        poll: () => Promise.resolve(polls.shift() ?? remote('succeeded', { progress: 100 })),
        cancel: () => Promise.resolve(),
      },
    })

    manager.submit('model_flux', 'Flux', {})
    await settled()

    expect(progress.map(entry => [entry.status, entry.progress])).toEqual([
      ['queued', 0],
      ['running', 0.4],
      ['running', 1],
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

    const accounts = {
      active: () =>
        switched
          ? { id: 'account_other', account: other }
          : { id: 'account_studio', account: studio },
      of: (id: string) => (id === 'account_other' ? other : studio),
    }

    const { manager } = harness({ accounts })
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
    const { manager } = harness({ accounts: { active: () => null, of: () => null } })

    manager.submit('model_flux', 'Flux', {})
    await settled()

    expect(manager.list()[0]).toMatchObject({ status: 'failed', error: 'missing' })
  })
})

/**
 * A generation is minutes spent elsewhere, and the studio may well be closed before it ends.
 * The job finishes at Scenario either way: what is lost is the studio ever collecting it.
 */
describe('a job that outlives the session', () => {
  /** Held open at the poll, so the job stays unfinished for as long as the test needs it. */
  const holding = (): Partial<HarnessOptions> => ({
    runner: {
      submit: () => Promise.resolve(remote('in-progress')),
      poll: () => new Promise<RemoteJob>(() => {}),
      cancel: () => Promise.resolve(),
    },
  })

  it('writes a job down once it exists at the API, and not before', async () => {
    const { manager, remembered } = harness(holding())

    manager.submit('model_veo', 'Veo', {})
    // Nothing was written at submission: no request had gone out, so nothing had been spent.
    expect(remembered()).toEqual([])

    await settled()

    expect(remembered()).toEqual([
      expect.objectContaining({
        remoteId: 'job_remote',
        modelId: 'model_veo',
        label: 'Veo',
        accountId: 'fingerprint_studio',
        projectPath: '/projects/kingdom',
      }),
    ])
  })

  it('forgets it again once it is finished', async () => {
    const { manager, remembered } = harness()

    manager.submit('model_flux', 'Flux', {})
    await settled()

    expect(manager.list()[0]?.status).toBe('succeeded')
    expect(remembered()).toEqual([])
  })

  it('polls a job it picked up, and collects what finished while the studio was closed', async () => {
    const submit = vi.fn(() => Promise.resolve(remote('success')))
    const { manager } = harness({
      runner: {
        submit,
        poll: () => Promise.resolve(remote('success', { metadata: { assetIds: ['r_1'] } })),
        cancel: () => Promise.resolve(),
      },
      collect: () => Promise.resolve(['asset_local']),
    })

    manager.resume([RUNNING])
    await settled()

    // Followed, never submitted a second time: the job already exists and has already been paid.
    expect(submit).not.toHaveBeenCalled()
    expect(manager.list()[0]).toMatchObject({
      id: RUNNING.id,
      label: 'Veo',
      status: 'succeeded',
      assetIds: ['asset_local'],
    })
  })

  /**
   * Its id means nothing under another key, so there is nothing to do this launch — but the key
   * may simply be a keychain that would not open yet, and erasing the note would delete every
   * paid job of the previous session in one pass.
   */
  it('gives up on one whose account the studio no longer holds, without forgetting it', async () => {
    const { manager, remembered } = harness({
      accounts: { active: () => null, of: () => null },
    })

    manager.resume([RUNNING])
    await settled()

    expect(manager.list()[0]).toMatchObject({ status: 'failed', error: 'missing' })
    expect(remembered()).toHaveLength(1)
  })

  // Taken by the API, the job is dead: a note kept would resume one that will never answer.
  it('forgets a cancelled job as soon as the API has taken the cancellation', async () => {
    const { manager, remembered } = harness(holding())

    const job = manager.submit('model_veo', 'Veo', {})
    await settled()
    expect(remembered()).toHaveLength(1)

    await manager.cancel(job.id)

    expect(remembered()).toEqual([])
  })

  // Refused, it is still running and still being charged: the note has to outlive the attempt.
  it('keeps the note of a cancellation the API would not take', async () => {
    const { manager, remembered } = harness({
      runner: {
        submit: () => Promise.resolve(remote('in-progress')),
        poll: () => new Promise<RemoteJob>(() => {}),
        cancel: () => Promise.reject(new APIConnectionError({})),
      },
    })

    const job = manager.submit('model_veo', 'Veo', {})
    await settled()
    await manager.cancel(job.id)

    expect(remembered()).toHaveLength(1)
  })

  /**
   * The failure that matters most, and the one the first draft of this got wrong: a poll giving
   * up is a local event. The generation is running and paid for at Scenario either way, so
   * forgetting it here is the exact loss the whole mechanism exists to prevent.
   */
  it('keeps the note of a job the studio lost touch with', async () => {
    const { manager, remembered } = harness({
      maxRetries: () => 0,
      runner: {
        submit: () => Promise.resolve(remote('in-progress')),
        poll: () => Promise.reject(new APIConnectionError({})),
        cancel: () => Promise.resolve(),
      },
    })

    manager.submit('model_veo', 'Veo', {})
    await settled()

    expect(manager.list()[0]).toMatchObject({ status: 'failed', error: 'network' })
    expect(remembered()).toHaveLength(1)
  })

  // The API said no. Nothing is owed, and a note kept would poll a job that will never run.
  it('forgets one the API itself refused', async () => {
    const { manager, remembered } = harness({
      runner: {
        submit: () => Promise.resolve(remote('failure')),
        poll: () => Promise.resolve(remote('failure')),
        cancel: () => Promise.resolve(),
      },
    })

    manager.submit('model_flux', 'Flux', {})
    await settled()

    expect(remembered()).toEqual([])
  })

  // The generation succeeded and is paid for; only the download failed, and it can be retried.
  it('keeps the note of a job whose outputs would not come down', async () => {
    const { manager, remembered } = harness({ collect: () => Promise.reject(new Error('disk')) })

    manager.submit('model_flux', 'Flux', {})
    await settled()

    expect(manager.list()[0]).toMatchObject({ status: 'failed', error: 'storage' })
    expect(remembered()).toHaveLength(1)
  })

  /**
   * The collector writes into whichever project is open. Rather than file this generation in
   * the wrong library, the job steps aside and its note waits for its own project to reopen.
   */
  it('leaves its outputs uncollected rather than put them in another project', async () => {
    let open = '/projects/kingdom'
    const collect = vi.fn(() => Promise.resolve(['asset_local']))
    const { manager, remembered } = harness({
      projectPath: () => open,
      collect,
      runner: {
        submit: () => Promise.resolve(remote('in-progress')),
        poll: () => {
          open = '/projects/dungeon'
          return Promise.resolve(remote('success', { metadata: { assetIds: ['r_1'] } }))
        },
        cancel: () => Promise.resolve(),
      },
    })

    manager.submit('model_veo', 'Veo', {})
    await settled()

    expect(collect).not.toHaveBeenCalled()
    expect(remembered()).toEqual([expect.objectContaining({ projectPath: '/projects/kingdom' })])
  })

  it('picks up a job once, however often it is handed the same note', async () => {
    const { manager } = harness()

    manager.resume([RUNNING])
    manager.resume([RUNNING])
    await settled()

    expect(manager.list()).toHaveLength(1)
  })

  /**
   * Queued is not the same as never submitted, and that is new with resumption: a picked-up job
   * waits its turn with a remote id already set. Dropped from the queue alone, it would keep
   * running and being charged for, and `settle` releases the account that could have stopped it.
   */
  it('tells the API about a picked-up job cancelled before its turn came', async () => {
    const cancel = vi.fn(() => Promise.resolve())
    // Nothing may run, so the job stays in the queue: `submit` and `poll` are never reached.
    const { manager, remembered } = harness({ concurrency: () => 0, runner: { cancel } })

    manager.resume([RUNNING])
    await settled()
    // Still in the queue, since nothing may run: this is the branch under test.
    expect(manager.list()[0]?.status).toBe('queued')

    await manager.cancel(RUNNING.id)

    expect(cancel).toHaveBeenCalledWith('job_remote')
    expect(manager.list()[0]?.status).toBe('cancelled')
    // Taken by the API, so nothing is owed and the note goes with it.
    expect(remembered()).toEqual([])
  })

  /**
   * Everything up to the API call is synchronous, so a second click lands while the first is
   * still in flight — and finds the job already out of the queue. Unguarded, it fell through to
   * the running branch and spent a second cancel, taking two of the five urgent slots.
   */
  it('tells the API once, however many times the user asks', async () => {
    const cancel = vi.fn(() => Promise.resolve())
    const { manager } = harness({ concurrency: () => 0, runner: { cancel } })

    manager.resume([RUNNING])
    await settled()
    await Promise.all([manager.cancel(RUNNING.id), manager.cancel(RUNNING.id)])

    expect(cancel).toHaveBeenCalledOnce()
  })

  // Refused, it is running and being charged: the note outlives the session that gave up on it.
  it('keeps the note of a queued job the API would not cancel', async () => {
    const { manager, remembered } = harness({
      concurrency: () => 0,
      runner: { cancel: () => Promise.reject(new APIConnectionError({})) },
    })

    manager.resume([RUNNING])
    await settled()
    await manager.cancel(RUNNING.id)

    expect(remembered()).toHaveLength(1)
  })

  /**
   * A note nothing can ever act on is not insurance, it is a job that fails again on every
   * project open until the sweep a week later — with a bogus red row each time.
   */
  it('forgets a resumed job whose remote record the API no longer has', async () => {
    const { manager, remembered } = harness({
      runner: { poll: () => Promise.reject(new APIError(404, undefined, 'gone', undefined)) },
    })

    manager.resume([RUNNING])
    await settled()

    expect(manager.list()[0]).toMatchObject({ status: 'failed', error: 'not-found' })
    expect(remembered()).toEqual([])
  })
})

describe('how often it asks the API where a job is', () => {
  /** Answers `in-progress` for a set number of polls, so the loop turns and then ends. */
  const polling = (polls: number): HarnessOptions => {
    let asked = 0
    return {
      runner: {
        submit: () => Promise.resolve(remote('in-progress')),
        poll: () => Promise.resolve(remote(++asked <= polls ? 'in-progress' : 'success')),
      },
    }
  }

  // One generation on its own: a progress bar that moves is worth thirty requests a minute.
  it('asks as fast as it may when a single job is running', async () => {
    const { manager, sleeps } = harness({ ...polling(2), concurrency: () => 1 })

    manager.submit('model_veo', 'Veo', {})
    await settled()

    expect(sleeps).toEqual([2000, 2000, 2000])
  })

  /**
   * Six jobs at two seconds would ask for 180 a minute against a hundred granted. Stretched, the
   * same six stay inside the share polling is allowed — which is what keeps them reported as
   * running rather than failed.
   */
  it('stretches the interval rather than ask for more than it is granted', async () => {
    const { manager, sleeps } = harness({ ...polling(18), concurrency: () => 6 })

    for (let index = 0; index < 6; index++) manager.submit('model_veo', 'Veo', {})
    await settled()

    // The widest, which is the interval while all six were being followed at once. Six jobs, one
    // request each per interval: this both stretches past the floor and stays inside the share.
    const interval = Math.max(...sleeps)
    expect((6 * 60_000) / interval).toBeLessThanOrEqual(POLL_REQUESTS_PER_MINUTE)
  })
})

describe('what the list itself announces', () => {
  it('announces the whole list when a job is picked up from a previous session', () => {
    const { manager, announced } = harness({ concurrency: () => 0 })

    manager.resume([RUNNING])

    expect(announced).toHaveLength(1)
    expect(announced[0]).toEqual([expect.objectContaining({ id: RUNNING.id, label: 'Veo' })])
  })

  // Handed nothing new, there is no composition to announce and no list to redraw.
  it('says nothing when the same note is handed twice', () => {
    const { manager, announced } = harness({ concurrency: () => 0 })

    manager.resume([RUNNING])
    manager.resume([RUNNING])

    expect(announced).toHaveLength(1)
  })

  /**
   * The one exit that leaves no outcome behind. Told nothing, a replica keeps drawing the job as
   * running for the rest of the session, with a cancel button the manager has no entry for.
   */
  it('announces the list when a job steps aside because its project closed', async () => {
    let open = '/projects/kingdom'
    const { manager, announced } = harness({
      projectPath: () => open,
      runner: {
        submit: () => Promise.resolve(remote('in-progress')),
        poll: () => {
          open = '/projects/dungeon'
          return Promise.resolve(remote('success', { metadata: { assetIds: ['r_1'] } }))
        },
      },
    })

    manager.submit('model_veo', 'Veo', {})
    await settled()

    // The submission announced it first; what matters is that its removal was announced too.
    expect(announced.at(-1)).toEqual([])
  })

  /**
   * The window that asked already holds it, but the others never will otherwise: they only hear
   * progress, and progress cannot be merged into a job a replica has never seen.
   */
  it('announces a submission too, for the windows that did not make it', async () => {
    const { manager, announced } = harness({ concurrency: () => 0 })

    manager.submit('model_flux', 'Flux', {})

    expect(announced).toEqual([[expect.objectContaining({ label: 'Flux' })]])
  })
})

/**
 * A generation is minutes spent elsewhere: the progress bar is long gone by the time it ends,
 * and a failure that only reached the terminal was a failure nobody was there for.
 */
describe('what a finished job leaves behind to read', () => {
  it('records a failure, naming the model rather than a code', async () => {
    const { manager, recorded } = harness({
      runner: {
        submit: () => Promise.resolve(remote('failure')),
        poll: () => Promise.resolve(remote('failure')),
        cancel: () => Promise.resolve(),
      },
    })

    manager.submit('model_flux', 'Flux', {})
    await settled()

    expect(recorded).toContainEqual({
      level: 'error',
      topic: 'generation',
      messageKey: 'activity.jobFailed',
      params: { name: 'Flux' },
    })
  })

  it('records what a success produced, counted rather than listed', async () => {
    const { manager, recorded } = harness({
      collect: () => Promise.resolve(['asset_1', 'asset_2']),
    })

    manager.submit('model_flux', 'Flux', {})
    await settled()

    expect(recorded).toContainEqual({
      level: 'info',
      topic: 'generation',
      messageKey: 'activity.generated',
      params: { count: 2 },
    })
  })

  // Nothing came of it, so there is nothing to say: a line saying "0 assets generated" is one
  // the reader has to work out the meaning of.
  it('says nothing about a success that produced no asset', async () => {
    const { manager, recorded } = harness({ collect: () => Promise.resolve([]) })

    manager.submit('model_flux', 'Flux', {})
    await settled()

    expect(recorded).toEqual([])
  })

  it('records a cancellation as a fact rather than as a failure', async () => {
    const { manager, recorded } = harness({
      concurrency: () => 1,
      runner: {
        submit: () => new Promise<RemoteJob>(() => {}),
        poll: () => Promise.resolve(remote('success')),
        cancel: () => Promise.resolve(),
      },
    })

    manager.submit('model_veo', 'Veo', {})
    const queued = manager.submit('model_veo', 'Veo', {})
    await manager.cancel(queued.id)

    expect(recorded).toContainEqual({
      level: 'info',
      topic: 'generation',
      messageKey: 'activity.jobCancelled',
      params: { name: 'Veo' },
    })
  })

  // The message is a key and its parameters, never a sentence: a journal written in French is
  // French for ever, and reads as gibberish once the interface is in English.
  it('never stores a sentence, only a key and what fills it', async () => {
    const { manager, recorded } = harness({ collect: () => Promise.resolve(['asset_1']) })

    manager.submit('model_flux', 'Flux', {})
    await settled()

    for (const report of recorded) expect(report.messageKey).toMatch(/^activity\./)
  })
})
