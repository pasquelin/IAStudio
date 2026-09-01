import { APIConnectionError, APIError } from '@scenario-labs/sdk'
import { describe, expect, it, vi } from 'vitest'
import type { Job, JobProgress, JobStatus } from '@shared/domain/job'
import type { WorkspaceId } from '@shared/domain/workspace'
import type { ActivityReport } from '@main/project/activityLog'
import {
  createJobManager,
  jobProgressOf,
  jobStatusOf,
  POLL_REQUESTS_PER_MINUTE,
  type AssetCollector,
  type CollectedOutputs,
  type JobManager,
  type JobManagerDeps,
  type JobRunner,
  type RemoteJob,
} from './jobManager'
import type { PersistedJob } from './persistedJob'

const settled = (): Promise<void> => new Promise(resolve => setImmediate(resolve))

/**
 * Counted across the whole harness rather than per job, so it has to clear the busiest test by
 * a wide margin — a runaway loop reaches it in milliseconds either way.
 */
const RUNAWAY_SLEEPS = 1000

function remote(status: string, overrides: Partial<RemoteJob> = {}): RemoteJob {
  return { jobId: 'job_remote', status, progress: 0, assetIds: [], ...overrides }
}

/** A note a previous session left behind: the job exists at the API and has been paid for. */
const RUNNING: PersistedJob = {
  id: 'job_left_running',
  remoteId: 'job_remote',
  targetId: 'model_veo',
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

/** What a collector answers with. Typed here so a shelf id stays one rather than widening. */
const landing = (ids: string[], workspaces: WorkspaceId[] = ['image']): Promise<CollectedOutputs> =>
  Promise.resolve({ ids, workspaces })

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
    collect: collect ?? (() => landing([], [])),
  }

  const manager = createJobManager({
    accounts: { active: () => ({ id: 'fingerprint_studio', account }), of: () => account },
    projectPath: () => '/projects/kingdom',
    // The manifest's name, which is what the shelf holds — never the folder the project sits in.
    projectNameOf: path => (path === '/projects/kingdom' ? 'Royaume' : 'Donjon'),
    persist: jobs => void (remembered = [...jobs]),
    concurrency: () => 2,
    maxRetries: () => 3,
    resolveAssetInputs: (body: Record<string, unknown>) => Promise.resolve(body),
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
  it('folds the two outcomes the guide spells differently', () => {
    expect(jobStatusOf('succeeded')).toBe('succeeded')
    expect(jobStatusOf('failed')).toBe('failed')
  })

  /**
   * 🛑 A second cloud spells three outcomes Scenario never does. Unmapped, each folds onto
   * `running` and polls for ever holding its slot — and one lane's ceiling is ONE, so a single
   * banned picture would block every picture of the session.
   */
  it('folds the outcomes a second cloud spells its own way', () => {
    expect(jobStatusOf('cancelled')).toBe('cancelled')
    expect(jobStatusOf('banned')).toBe('failed')
    expect(jobStatusOf('expired')).toBe('failed')
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
    const job = manager.submit({ id: 'model_flux' }, 'Flux', { prompt: 'a rock' })

    expect(job).toMatchObject({
      targetId: 'model_flux',
      label: 'Flux',
      status: 'queued',
      progress: 0,
    })
  })

  /** What the target names has to survive the queue to reach the runner that submits it. */
  it('carries what a job runs through to the runner', async () => {
    const submit = vi.fn(() => Promise.resolve(remote('success')))
    const { manager } = harness({ runner: { submit } })

    manager.submit({ id: 'model_flux' }, 'Flux', { image: 'a' })
    await settled()

    expect(submit).toHaveBeenCalledWith({ id: 'model_flux' }, { image: 'a' })
  })

  /**
   * The ids a form hands over are the studio's own, which the API answers 404 on — see
   * `assetInputs.ts`. Translated here rather than at the boundary, so that sending a file up
   * happens under this loop's bound, with the job already on screen.
   */
  it('runs what the asset translation gave back, over the body it was submitted with', async () => {
    const submit = vi.fn(() => Promise.resolve(remote('success')))
    // Reads its argument, or translating the wrong body — or none at all — would pass here.
    const resolveAssetInputs = vi.fn((body: Record<string, unknown>) =>
      Promise.resolve({ ...body, image: 'asset_remote' }),
    )
    const { manager } = harness({ runner: { submit }, resolveAssetInputs })

    manager.submit({ id: 'model_flux' }, 'Flux', {
      image: 'asset_local',
      prompt: 'a fox',
    })
    await settled()

    // The TARGET travels with the body: a picture is turned into a remote id for the cloud and
    // into a path on this disk for a model that runs here, and only the target says which.
    expect(resolveAssetInputs).toHaveBeenCalledWith(
      { image: 'asset_local', prompt: 'a fox' },
      { id: 'model_flux' },
    )
    expect(submit).toHaveBeenCalledWith(
      { id: 'model_flux' },
      { image: 'asset_remote', prompt: 'a fox' },
    )
  })

  // The longer of the two calls on the wire, so the one a dropped connection finds — and the
  // one whose failure would otherwise cost a whole upload for nothing.
  it('retries a translation that failed on the wire, as it retries a submission', async () => {
    let attempts = 0
    const resolveAssetInputs = vi.fn((body: Record<string, unknown>) => {
      attempts += 1
      return attempts === 1
        ? Promise.reject(APIError.generate(503, undefined, 'upstream', new Headers()))
        : Promise.resolve(body)
    })
    const { manager, progress } = harness({ resolveAssetInputs })

    manager.submit({ id: 'model_flux' }, 'Flux', { image: 'asset_local' })
    await settled()

    expect(attempts).toBe(2)
    expect(progress.at(-1)).toMatchObject({ status: 'succeeded' })
  })

  // Queued first and failed after, rather than a channel held open with nothing on screen: an
  // upload is a file transfer of any size, and it is the job that says so while it runs.
  it('fails the job it already queued when an asset cannot be sent up', async () => {
    const submit = vi.fn(() => Promise.resolve(remote('success')))
    const { manager, progress } = harness({
      runner: { submit },
      resolveAssetInputs: () => Promise.reject(new Error('upload-too-large')),
    })

    const job = manager.submit({ id: 'model_flux' }, 'Flux', {
      image: 'asset_local',
    })
    expect(job.status).toBe('queued')
    await settled()

    expect(submit).not.toHaveBeenCalled()
    expect(progress.at(-1)).toMatchObject({ id: job.id, status: 'failed' })
  })

  /**
   * Nothing reaches a transfer already under way, so cancelling during one is heard only once it
   * ends. What must not happen is the studio calling it an error: the journal would carry a
   * failure for something the user asked to stop.
   */
  it('reports a job cancelled mid-upload as cancelled, not as failed', async () => {
    let release = (): void => {}
    const held = new Promise<void>(resolve => {
      release = resolve
    })
    const { manager, progress } = harness({
      resolveAssetInputs: () => held.then(() => Promise.reject(new Error('upload-too-large'))),
    })

    const job = manager.submit({ id: 'model_flux' }, 'Flux', { image: 'asset_x' })
    await settled()
    await manager.cancel(job.id)
    release()
    await settled()

    expect(progress.at(-1)).toMatchObject({ id: job.id, status: 'cancelled' })
    expect(progress.at(-1)?.error).toBeUndefined()
  })

  it('remembers what a running job runs, so a resumed one still names its target', async () => {
    // Every note written along the way: the last one is empty, since the job finishes here.
    const written: PersistedJob[][] = []
    const { manager } = harness({
      runner: { submit: () => Promise.resolve(remote('in-progress')) },
      persist: jobs => void written.push([...jobs]),
    })

    manager.submit({ id: 'model_flux' }, 'Flux', {})
    await settled()

    expect(written[0]?.[0]).toMatchObject({ targetId: 'model_flux' })
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

    for (let index = 0; index < 6; index++) manager.submit({ id: 'model_flux' }, 'Flux', {})
    await settled()

    expect(peak).toBe(2)

    while (release.length > 0) {
      release.shift()?.()
      await settled()
    }

    expect(manager.list().every(job => job.status === 'succeeded')).toBe(true)
    expect(peak).toBe(2)
  })

  /**
   * Two exclusive doors on one GPU fight. A job on this machine takes the local slot; a cloud
   * job does not, so an image denoise does not hold a 3D generation that runs somewhere else.
   */
  it('lets a cloud job start while this machine is already generating', async () => {
    const started: string[] = []
    const release: Record<string, () => void> = {}

    const { manager } = harness({
      concurrency: () => 2,
      isLocalTarget: id => id === 'sana',
      runner: {
        submit: target =>
          new Promise(resolve => {
            started.push(target.id)
            release[target.id] = () => resolve(remote('success'))
          }),
      },
    })

    manager.submit({ id: 'sana' }, 'Sana', {})
    manager.submit({ id: 'model_flux' }, 'Flux', {})
    await settled()

    expect(started.sort()).toEqual(['model_flux', 'sana'])

    release['sana']?.()
    release['model_flux']?.()
    await settled()
  })

  /**
   * A FIFO that only looks at the head would keep Flux queued behind Shap-E while Sana holds the
   * local slot. The cloud job must overtake.
   */
  it('starts a cloud job even when a local one is waiting behind another', async () => {
    const started: string[] = []
    const release: Record<string, () => void> = {}

    const { manager } = harness({
      concurrency: () => 1,
      isLocalTarget: id => id !== 'model_flux',
      runner: {
        submit: target =>
          new Promise(resolve => {
            started.push(target.id)
            release[target.id] = () => resolve(remote('success'))
          }),
      },
    })

    manager.submit({ id: 'sana' }, 'Sana', {})
    await settled()
    manager.submit({ id: 'shap-e' }, 'Shap-E', {})
    manager.submit({ id: 'model_flux' }, 'Flux', {})
    await settled()

    expect(started).toEqual(['sana', 'model_flux'])

    release['sana']?.()
    await settled()
    expect(started).toContain('shap-e')
    release['shap-e']?.()
    release['model_flux']?.()
    await settled()
  })

  /**
   * A cloud whose ceilings are per CATEGORY — Tripo counts one picture at a time against ten
   * meshes. A single number for the whole cloud would refuse the mesh or take a certain 429 on
   * the second picture.
   */
  it('holds a category at its own ceiling while another category runs freely', async () => {
    const started: string[] = []
    const release: Record<string, () => void> = {}

    const { manager } = harness({
      concurrency: () => 5,
      lane: id => (id.startsWith('tripo:') ? { name: id.split(':')[1] ?? '', limit: 1 } : null),
      runner: {
        submit: target =>
          new Promise(resolve => {
            started.push(target.id)
            release[target.id] = () => resolve(remote('success'))
          }),
      },
    })

    manager.submit({ id: 'tripo:image:one' }, 'One', {})
    manager.submit({ id: 'tripo:image:two' }, 'Two', {})
    manager.submit({ id: 'tripo:mesh:three' }, 'Three', {})
    await settled()

    expect(started).toEqual(['tripo:image:one', 'tripo:mesh:three'])

    release['tripo:image:one']?.()
    await settled()
    expect(started).toContain('tripo:image:two')

    release['tripo:image:two']?.()
    release['tripo:mesh:three']?.()
    await settled()
  })

  /**
   * A service that does not stop what it started — the row draws what the manager decided, and
   * names no cloud of its own.
   */
  it('marks a job the service will not stop as uncancellable, and every other one as nothing', () => {
    const { manager } = harness({
      cancellableTarget: targetId => targetId !== 'tripo:one',
    })

    expect(manager.submit({ id: 'tripo:one' }, 'One', {}).cancellable).toBe(false)
    expect(manager.submit({ id: 'model_flux' }, 'Flux', {}).cancellable).toBeUndefined()
  })

  /**
   * 🛑 A resumed job carries no such word in its note. Left unread, a generation of a service
   * that does not stop one came back cancellable after a relaunch — and reporting it stopped is
   * exactly what the flag prevents.
   */
  it('reads again, on a resumed job, whether its service stops what it started', () => {
    const { manager } = harness({
      cancellableTarget: targetId => targetId !== 'model_veo',
      runner: { poll: () => new Promise<RemoteJob>(() => {}) },
    })

    manager.resume([RUNNING])

    expect(manager.list()[0]?.cancellable).toBe(false)
  })

  it('never runs two jobs on this machine at once', async () => {
    let active = 0
    let peak = 0
    const release: (() => void)[] = []

    const { manager } = harness({
      concurrency: () => 4,
      isLocalTarget: () => true,
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
      },
    })

    manager.submit({ id: 'sana' }, 'Sana', {})
    manager.submit({ id: 'shap-e' }, 'Shap-E', {})
    await settled()

    expect(peak).toBe(1)

    while (release.length > 0) {
      release.shift()?.()
      await settled()
    }

    expect(peak).toBe(1)
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

    manager.submit({ id: 'model_flux' }, 'Flux', {})
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

    manager.submit({ id: 'model_flux' }, 'Flux', {})
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

    manager.submit({ id: 'model_flux' }, 'Flux', {})
    await settled()

    // Doubling, within the ±20 % the jitter spreads them over — three jobs that take a 429
    // together must not come back together, which an exact sequence would forbid.
    expect(sleeps).toHaveLength(2)
    expect(sleeps[0]).toBeGreaterThanOrEqual(800)
    expect(sleeps[0]).toBeLessThanOrEqual(1200)
    expect(sleeps[1]).toBeGreaterThanOrEqual(1600)
    expect(sleeps[1]).toBeLessThanOrEqual(2400)
    expect(manager.list()[0]?.status).toBe('succeeded')
  })

  /**
   * 🛑 A runner may keep what it answered WITH — `codeJobRunner` holds a whole script — and only
   * the manager knows when it will never poll again. Told on the poll instead, the script would
   * be gone by the resume the step-aside below needs.
   */
  it('tells the runner it is done with a job once the outcome is settled', async () => {
    const forget = vi.fn()
    const { manager } = harness({
      runner: {
        submit: () => Promise.resolve(remote('in-progress')),
        poll: () => Promise.resolve(remote('success', { assetIds: ['r_1'] })),
        cancel: () => Promise.resolve(),
        forget,
      },
    })

    manager.submit({ id: 'model_flux' }, 'Flux', {})
    await settled()

    expect(forget).toHaveBeenCalledWith('job_remote', { id: 'model_flux' })
  })

  /** The step aside settles nothing, so what the runner kept has to outlive it — see the resume. */
  it('tells it nothing when the job steps aside for a project that closed', async () => {
    let open: string | null = '/projects/kingdom'
    const forget = vi.fn()
    const { manager } = harness({
      projectPath: () => open,
      runner: {
        submit: () => Promise.resolve(remote('in-progress')),
        poll: () => {
          open = null
          return Promise.resolve(remote('success', { assetIds: ['r_1'] }))
        },
        cancel: () => Promise.resolve(),
        forget,
      },
    })

    manager.submit({ id: 'model_veo' }, 'Veo', {})
    await settled()

    expect(forget).not.toHaveBeenCalled()
  })

  it('gives up on an error a retry cannot fix', async () => {
    const submit = vi.fn(() =>
      Promise.reject(APIError.generate(400, undefined, 'bad body', new Headers())),
    )
    const { manager } = harness({
      runner: { submit, poll: () => Promise.resolve(remote('success')), cancel: vi.fn() },
    })

    manager.submit({ id: 'model_flux' }, 'Flux', {})
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

    manager.submit({ id: 'model_flux' }, 'Flux', {})
    // Awaited, because the first job now translates its asset ids before it submits: without
    // this it would still be holding the slot on that step, and the runner untouched either way.
    await settled()
    const queued = manager.submit({ id: 'model_flux' }, 'Flux', {})
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

    const job = manager.submit({ id: 'model_flux' }, 'Flux', {})
    await settled()
    await manager.cancel(job.id)

    expect(cancel).toHaveBeenCalledWith('job_remote', { id: 'model_flux' })
  })

  it('succeeds only once the assets are indexed', async () => {
    const order: string[] = []
    const { manager, progress } = harness({
      runner: {
        submit: () => Promise.resolve(remote('success', { assetIds: ['remote_1'] })),
        poll: () => Promise.resolve(remote('success')),
        cancel: () => Promise.resolve(),
      },
      collect: (_job, remoteAssetIds) => {
        order.push(`collect:${remoteAssetIds.join(',')}`)
        return landing(['asset_local'])
      },
      onProgress: entry => void order.push(`progress:${entry.status}`),
    })

    manager.submit({ id: 'model_flux' }, 'Flux', {})
    await settled()

    expect(order).toEqual(['progress:queued', 'collect:remote_1', 'progress:succeeded'])
    expect(manager.list()[0]?.assetIds).toEqual(['asset_local'])
    expect(progress).toEqual([])
  })

  it("hands the collector the runner's job id", async () => {
    const seen: Array<string | undefined> = []
    const { manager } = harness({
      runner: {
        submit: () => Promise.resolve(remote('success', { jobId: 'local_abc' })),
        poll: () => Promise.resolve(remote('success', { jobId: 'local_abc' })),
        cancel: () => Promise.resolve(),
      },
      collect: job => {
        seen.push(job.remoteId)
        return landing(['asset_local'])
      },
    })

    manager.submit({ id: 'sana-600m-1024' }, 'Sana', {})
    await settled()

    expect(seen).toEqual(['local_abc'])
  })

  /** Each outcome, beside the spelling the API answers it with. */
  const SETTLED: readonly [JobStatus, string][] = [
    ['succeeded', 'success'],
    ['failed', 'failed'],
    ['cancelled', 'canceled'],
  ]

  /**
   * The shape the renderer's fixture builds on (`stores/job-fixtures.ts`). Held here because a
   * fixture can only assert against its own text: if `settle` stopped dating a job, five suites
   * would go on passing against a job this process no longer produces.
   */
  it.each(SETTLED)(
    'dates a %s job, and carries a succeeded one to full progress',
    async (status, spelling) => {
      const { manager } = harness({
        runner: {
          submit: () => Promise.resolve(remote(spelling)),
          poll: () => Promise.resolve(remote(spelling)),
          cancel: () => Promise.resolve(),
        },
      })

      manager.submit({ id: 'model_flux' }, 'Flux', {})
      await settled()

      const [job] = manager.list()
      expect(job?.status).toBe(status)
      expect(job?.finishedAt).toEqual(expect.any(String))
      expect(job?.progress).toBe(status === 'succeeded' ? 1 : 0)
    },
  )

  // A local write failure is not what the API said, and neither is a code the renderer can
  // mistake for an API problem.
  it('fails the job on a storage code when its assets cannot be brought down', async () => {
    const { manager } = harness({
      collect: () => Promise.reject(new Error('disk full')),
    })

    manager.submit({ id: 'model_flux' }, 'Flux', {})
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

    manager.submit({ id: 'model_flux' }, 'Flux', {})
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

    manager.submit({ id: 'model_flux' }, 'Flux', {})
    await settled()

    expect(manager.list()[0]).toMatchObject({ status: 'failed', error: 'rejected' })
  })

  it('lists the most recent job first', async () => {
    const { manager } = harness()
    manager.submit({ id: 'model_flux' }, 'Flux', {})
    const second = manager.submit({ id: 'model_veo' }, 'Veo', {})
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
        return Promise.resolve(remote('success', { jobId, assetIds: ['r_1'] }))
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
      collect: vi.fn(() => landing(['asset_local'])),
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

    manager.submit({ id: 'model_veo' }, 'Veo', {})
    await settled()

    expect(studio.runner.poll).toHaveBeenCalledTimes(2)
    expect(other.runner.poll).not.toHaveBeenCalled()
    expect(manager.list()[0]).toMatchObject({ status: 'succeeded', assetIds: ['asset_local'] })
  })

  // The output is retrieved with the same key that generated it — a signed URL from the other
  // account's client answers 404, which the collector reports as a local storage failure.
  it('collects the outputs on that same account', async () => {
    const { manager, studio, other } = switching()

    manager.submit({ id: 'model_veo' }, 'Veo', {})
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

    const job = manager.submit({ id: 'model_veo' }, 'Veo', {})
    await settled()
    switchAccount()
    await manager.cancel(job.id)

    expect(studio.runner.cancel).toHaveBeenCalledWith('job_remote', { id: 'model_veo' })
    expect(other.runner.cancel).not.toHaveBeenCalled()
  })

  it('fails a job submitted without a key rather than borrowing one added since', async () => {
    const { manager } = harness({ accounts: { active: () => null, of: () => null } })

    manager.submit({ id: 'model_flux' }, 'Flux', {})
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

  /** A generation prices the request, beside the job: that figure is only ever said once. */
  it('keeps what the submission said the job cost', async () => {
    const { manager, progress } = harness({
      runner: { submit: () => Promise.resolve(remote('success', { cost: 12 })) },
    })

    manager.submit({ id: 'model_flux' }, 'Flux', {})
    await settled()

    expect(manager.list()[0]?.cost).toBe(12)
    expect(progress.at(-1)?.cost).toBe(12)
  })

  it('leaves the cost unsaid when the API priced nothing', async () => {
    const { manager } = harness()

    manager.submit({ id: 'model_flux' }, 'Flux', {})
    await settled()

    expect(manager.list()[0]?.cost).toBeUndefined()
  })

  /** Submitted in another session, so a poll is the only place its cost can still arrive. */
  it('takes the cost a poll brings for a job it never submitted', async () => {
    let polls = 0
    // The figure rides the poll that is still running, and the one that ends says nothing: read
    // anywhere but in `advance`, there would be no 7 left to find at the end of this.
    const { manager, progress } = harness({
      runner: {
        submit: () => Promise.resolve(remote('in-progress')),
        poll: () =>
          Promise.resolve(
            polls++ === 0 ? remote('in-progress', { progress: 0.5, cost: 7 }) : remote('success'),
          ),
        cancel: () => Promise.resolve(),
      },
    })

    manager.resume([RUNNING])
    await settled()

    expect(manager.list()[0]?.cost).toBe(7)
    expect(progress.at(-1)?.cost).toBe(7)
  })

  it('writes a job down once it exists at the API, and not before', async () => {
    const { manager, remembered } = harness(holding())

    manager.submit({ id: 'model_veo' }, 'Veo', {})
    // Nothing was written at submission: no request had gone out, so nothing had been spent.
    expect(remembered()).toEqual([])

    await settled()

    expect(remembered()).toEqual([
      expect.objectContaining({
        remoteId: 'job_remote',
        targetId: 'model_veo',
        label: 'Veo',
        accountId: 'fingerprint_studio',
        projectPath: '/projects/kingdom',
      }),
    ])
  })

  it('forgets it again once it is finished', async () => {
    const { manager, remembered } = harness()

    manager.submit({ id: 'model_flux' }, 'Flux', {})
    await settled()

    expect(manager.list()[0]?.status).toBe('succeeded')
    expect(remembered()).toEqual([])
  })

  it('polls a job it picked up, and collects what finished while the studio was closed', async () => {
    const submit = vi.fn(() => Promise.resolve(remote('success')))
    const { manager } = harness({
      runner: {
        submit,
        poll: () => Promise.resolve(remote('success', { assetIds: ['r_1'] })),
        cancel: () => Promise.resolve(),
      },
      collect: () => landing(['asset_local']),
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

    const job = manager.submit({ id: 'model_veo' }, 'Veo', {})
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

    const job = manager.submit({ id: 'model_veo' }, 'Veo', {})
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

    manager.submit({ id: 'model_veo' }, 'Veo', {})
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

    manager.submit({ id: 'model_flux' }, 'Flux', {})
    await settled()

    expect(remembered()).toEqual([])
  })

  // The generation succeeded and is paid for; only the download failed, and it can be retried.
  it('keeps the note of a job whose outputs would not come down', async () => {
    const { manager, remembered } = harness({ collect: () => Promise.reject(new Error('disk')) })

    manager.submit({ id: 'model_flux' }, 'Flux', {})
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
    const collect = vi.fn(() => landing(['asset_local']))
    const { manager, remembered } = harness({
      projectPath: () => open,
      collect,
      runner: {
        submit: () => Promise.resolve(remote('in-progress')),
        poll: () => {
          open = '/projects/dungeon'
          return Promise.resolve(remote('success', { assetIds: ['r_1'] }))
        },
        cancel: () => Promise.resolve(),
      },
    })

    manager.submit({ id: 'model_veo' }, 'Veo', {})
    await settled()

    expect(collect).not.toHaveBeenCalled()
    expect(remembered()).toEqual([expect.objectContaining({ projectPath: '/projects/kingdom' })])
  })

  /**
   * The same step aside, for the case « Fermer le projet » made reachable: there is no library
   * to file into at all. The note is what carries the generation to the next opening — settling
   * it `failed` would announce a loss for work that is paid for and still on the API.
   */
  it('leaves its outputs uncollected when no project is open at all', async () => {
    let open: string | null = '/projects/kingdom'
    const collect = vi.fn(() => landing(['asset_local']))
    const { manager, remembered } = harness({
      projectPath: () => open,
      collect,
      runner: {
        submit: () => Promise.resolve(remote('in-progress')),
        poll: () => {
          open = null
          return Promise.resolve(remote('success', { assetIds: ['r_1'] }))
        },
        cancel: () => Promise.resolve(),
      },
    })

    manager.submit({ id: 'model_veo' }, 'Veo', {})
    await settled()

    expect(collect).not.toHaveBeenCalled()
    expect(manager.list()).toEqual([])
    expect(remembered()).toEqual([expect.objectContaining({ projectPath: '/projects/kingdom' })])
  })

  /**
   * What the question before leaving a project counts. Off the ENTRIES and not off `list()`,
   * because a job whose own project was closed earlier is still being polled — counted there, it
   * would put a stranger's generation in a sentence about this project.
   */
  describe('counting what is still running in a project', () => {
    it('counts only the unfinished jobs of the project it is asked about', async () => {
      let open = '/projects/kingdom'
      const { manager } = harness({
        projectPath: () => open,
        runner: {
          submit: () => Promise.resolve(remote('in-progress')),
          poll: () => new Promise(() => {}),
          cancel: () => Promise.resolve(),
        },
      })

      manager.submit({ id: 'model_flux' }, 'Kingdom', {})
      open = '/projects/dungeon'
      manager.submit({ id: 'model_flux' }, 'Dungeon', {})
      await settled()

      expect(manager.runningIn('/projects/kingdom')).toBe(1)
      expect(manager.runningIn('/projects/dungeon')).toBe(1)
      expect(manager.runningIn('/projects/nowhere')).toBe(0)
    })

    // A reasoning step nobody asked for is machinery: counting it would put a number in front of
    // someone for work they never started.
    it('never counts a discreet job', async () => {
      const { manager } = harness({
        runner: {
          submit: () => Promise.resolve(remote('in-progress')),
          poll: () => new Promise(() => {}),
          cancel: () => Promise.resolve(),
        },
      })

      void manager.run({ id: 'model_scenario-llm' }, 'Assistant', {})
      await settled()

      expect(manager.runningIn('/projects/kingdom')).toBe(0)
    })

    it('stops counting a job once it has settled', async () => {
      const { manager } = harness({ collect: () => landing(['asset_1']) })

      manager.submit({ id: 'model_flux' }, 'Flux', {})
      await settled()

      expect(manager.runningIn('/projects/kingdom')).toBe(0)
    })
  })

  /**
   * What the dialog before leaving a project is allowed to promise. A job is taken out of the
   * list only once it SUCCEEDS under another project (`collect`) or ages out of the finished
   * ones — never on the closing itself. So the bar goes on showing it, and any sentence about it
   * "leaving the bar" would be the opposite of what the person sees.
   */
  it('keeps showing a running job after its project was closed', async () => {
    let open: string | null = '/projects/kingdom'
    const { manager } = harness({
      projectPath: () => open,
      runner: {
        submit: () => Promise.resolve(remote('in-progress')),
        poll: () => new Promise(() => {}),
        cancel: () => Promise.resolve(),
      },
    })

    manager.submit({ id: 'model_flux' }, 'Flux', {})
    await settled()
    open = null

    expect(manager.list()).toHaveLength(1)
    expect(manager.list()[0]?.status).toBe('running')
  })

  /**
   * The whole promise the closing dialog makes, end to end: a generation that finishes while its
   * project is closed is not lost, and its outputs land in THAT project when it is opened again.
   * Each half is guarded on its own above; nothing measured the two together.
   */
  it('collects into its own project when that project is opened again', async () => {
    let open: string | null = '/projects/kingdom'
    let left = false
    const collect = vi.fn(() => landing(['asset_local']))
    const { manager, remembered } = harness({
      projectPath: () => open,
      collect,
      runner: {
        submit: () => Promise.resolve(remote('in-progress')),
        // The FIRST poll leaves the project, and only that one: the poll after the reopening has
        // to find it open, or the decor would be measuring itself rather than the manager.
        poll: () => {
          if (!left) {
            left = true
            open = null
          }
          return Promise.resolve(remote('success', { assetIds: ['r_1'] }))
        },
        cancel: () => Promise.resolve(),
      },
    })

    // Submitted IN the kingdom — the project rides on the entry from that moment — and left
    // before the poll comes back.
    manager.submit({ id: 'model_veo' }, 'Veo', {})
    await settled()

    expect(collect).not.toHaveBeenCalled()
    const note = remembered()
    expect(note).toEqual([expect.objectContaining({ projectPath: '/projects/kingdom' })])

    // …and the project is opened again, which is what `resumeJobsOf` does with that note.
    open = '/projects/kingdom'
    manager.resume(note)
    await settled()

    expect(collect).toHaveBeenCalledTimes(1)
    expect(manager.list()[0]).toMatchObject({ status: 'succeeded', assetIds: ['asset_local'] })
  })

  /**
   * The row leaves the bar with no outcome shown, and the note behind it says nothing until its
   * project is opened again. This line is the only thing that says where the work went — and it
   * is a TOAST (`ATTENTION_MESSAGES`), because the journal of a project nobody has open holds
   * nothing anyone will read.
   */
  it('says where the work went when it steps aside', async () => {
    let open = '/projects/kingdom'
    const { manager, recorded } = harness({
      projectPath: () => open,
      collect: () => landing(['asset_local']),
      runner: {
        submit: () => Promise.resolve(remote('in-progress')),
        poll: () => {
          open = '/projects/dungeon'
          return Promise.resolve(remote('success', { assetIds: ['r_1'] }))
        },
        cancel: () => Promise.resolve(),
      },
    })

    manager.submit({ id: 'model_veo' }, 'Veo', {})
    await settled()

    expect(recorded).toContainEqual({
      level: 'info',
      topic: 'generation',
      messageKey: 'activity.jobWaitsForProject',
      // Its MANIFEST name, not the folder: a rename writes one and leaves the other alone.
      params: { label: 'Veo', project: 'Royaume' },
    })
  })

  /**
   * A discreet job owes its outputs to no project, so the guard above must not see it at all.
   * Leaving by that exit settled nothing, and `run` awaits the outcome: an assistant whose
   * project changed mid-thought waited for an answer that never came.
   */
  it('settles a discreet job whose project changed, rather than leaving it hanging', async () => {
    let open = '/projects/kingdom'
    const { manager, recorded } = harness({
      projectPath: () => open,
      runner: {
        submit: () => Promise.resolve(remote('in-progress')),
        poll: () => {
          open = '/projects/dungeon'
          return Promise.resolve(remote('success', { assetIds: ['r_1'] }))
        },
        cancel: () => Promise.resolve(),
      },
    })

    const job = await manager.run({ id: 'model_scenario-llm' }, 'Assistant', {})

    expect(job.status).toBe('succeeded')
    // And nothing is said about it: nobody asked for this one, and nobody is waiting for it.
    expect(recorded.map(one => one.messageKey)).not.toContain('activity.jobWaitsForProject')
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

    expect(cancel).toHaveBeenCalledWith('job_remote', { id: 'model_veo' })
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

    manager.submit({ id: 'model_veo' }, 'Veo', {})
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

    for (let index = 0; index < 6; index++) manager.submit({ id: 'model_veo' }, 'Veo', {})
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
          return Promise.resolve(remote('success', { assetIds: ['r_1'] }))
        },
      },
    })

    manager.submit({ id: 'model_veo' }, 'Veo', {})
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

    manager.submit({ id: 'model_flux' }, 'Flux', {})

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

    manager.submit({ id: 'model_flux' }, 'Flux', {})
    await settled()

    expect(recorded).toContainEqual({
      level: 'error',
      topic: 'generation',
      messageKey: 'activity.jobFailed',
      params: { name: 'Flux' },
    })
  })

  /**
   * Counted rather than listed — and the shelves named, which is the half nobody could guess: an
   * App produces what it produces whichever space launched it, so a run started in 3D can leave
   * a picture in the Image shelf and nothing said where it went.
   */
  it('records what a success produced, and the shelves it landed in', async () => {
    const { manager, recorded } = harness({
      collect: () => landing(['asset_1', 'asset_2'], ['image', '3d']),
    })

    manager.submit({ id: 'model_flux' }, 'Flux', {})
    await settled()

    expect(recorded).toContainEqual({
      level: 'info',
      topic: 'generation',
      messageKey: 'activity.generatedInto',
      params: { count: 2, workspaces: ['image', '3d'] },
    })
  })

  // Ids, never names: the line outlives the language it was written in.
  it('leaves the shelves out when the collector named none', async () => {
    const { manager, recorded } = harness({ collect: () => landing(['asset_1'], []) })

    manager.submit({ id: 'model_flux' }, 'Flux', {})
    await settled()

    expect(recorded).toContainEqual({
      level: 'info',
      topic: 'generation',
      messageKey: 'activity.generated',
      params: { count: 1 },
    })
  })

  // Nothing came of it, so there is nothing to say: a line saying "0 assets generated" is one
  // the reader has to work out the meaning of.
  it('says nothing about a success that produced no asset', async () => {
    const { manager, recorded } = harness({ collect: () => landing([], []) })

    manager.submit({ id: 'model_flux' }, 'Flux', {})
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

    manager.submit({ id: 'model_veo' }, 'Veo', {})
    const queued = manager.submit({ id: 'model_veo' }, 'Veo', {})
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
    const { manager, recorded } = harness({ collect: () => landing(['asset_1']) })

    manager.submit({ id: 'model_flux' }, 'Flux', {})
    await settled()

    for (const report of recorded) expect(report.messageKey).toMatch(/^activity\./)
  })
})

/**
 * The assistant reasons by running a text model, which is machinery rather than a generation.
 * It needs this loop — the queue, the concurrency bound, the retries, the one poll — and none of
 * what surrounds a generation, because a sentence typed at the assistant is not something the
 * person asked to watch, keep, or find in their library afterwards.
 */
describe('a job nobody asked to see', () => {
  it('answers what became of it, rather than being watched', async () => {
    const { manager } = harness({
      runner: { submit: () => Promise.resolve(remote('success', { assetIds: ['asset_reply'] })) },
    })

    const job = await manager.run({ id: 'model_scenario-llm' }, 'Assistant', {})

    expect(job.status).toBe('succeeded')
  })

  /**
   * The line that keeps the assistant out of the asset browser. Collecting would download a
   * fragment of JSON into the project and index it beside the person's own work; the ids kept
   * are the API's own, which is where the answer is read from.
   */
  it('collects nothing, and keeps the ids the API gave', async () => {
    const collect = vi.fn(() => landing(['asset_local']))
    const { manager } = harness({
      collect,
      runner: { submit: () => Promise.resolve(remote('success', { assetIds: ['asset_reply'] })) },
    })

    const job = await manager.run({ id: 'model_scenario-llm' }, 'Assistant', {})

    expect(collect).not.toHaveBeenCalled()
    expect(job.assetIds).toEqual(['asset_reply'])
  })

  /**
   * 🛑 The assistant's stop must reach a job that is BILLED and that nobody is watching: without
   * this, pressing stop left the sentence running to its end and paid for it.
   */
  it('is cancelled by the signal the caller armed it with', async () => {
    const cancel = vi.fn(() => Promise.resolve())
    const { manager } = harness({
      runner: {
        cancel,
        submit: () => Promise.resolve(remote('in-progress')),
        poll: () => new Promise(() => {}),
      },
    })
    const stopping = new AbortController()

    void manager.run({ id: 'model_scenario-llm' }, 'Assistant', {}, stopping.signal)
    await settled()
    stopping.abort()
    await settled()

    expect(cancel).toHaveBeenCalled()
  })

  // A stop pressed while the queue was full arrives before the job is ever submitted.
  it('is cancelled by a signal that was already aborted when it was queued', async () => {
    const cancel = vi.fn(() => Promise.resolve())
    const { manager } = harness({
      runner: {
        cancel,
        submit: () => Promise.resolve(remote('in-progress')),
        poll: () => new Promise(() => {}),
      },
    })
    const stopping = new AbortController()
    stopping.abort()

    const job = await manager.run({ id: 'model_scenario-llm' }, 'Assistant', {}, stopping.signal)

    expect(job.status).toBe('cancelled')
  })

  it('never reaches the jobs bar', async () => {
    const { manager, progress, announced } = harness()

    await manager.run({ id: 'model_scenario-llm' }, 'Assistant', {})

    expect(progress).toEqual([])
    expect(announced).toEqual([])
    expect(manager.list()).toEqual([])
  })

  it('writes nothing to the journal', async () => {
    const { manager, recorded } = harness({
      runner: { submit: () => Promise.resolve(remote('success', { assetIds: ['asset_reply'] })) },
    })

    await manager.run({ id: 'model_scenario-llm' }, 'Assistant', {})

    expect(recorded).toEqual([])
  })

  /**
   * Picked up tomorrow, a reasoning step would answer a question nobody is still asking — and
   * charge an account for it. So it goes through the loop that persists, and is not written.
   *
   * The runner SETTLES on the second look rather than answering `in-progress` for ever. A poll
   * loop with no way out spins past the end of the test on the microtask queue, and the
   * harness's runaway guard then throws into whatever file happens to be running — which is
   * exactly what it did, as an unhandled error nobody could place.
   */
  it('is never written down to be resumed', async () => {
    let looks = 0
    const { manager, remembered } = harness({
      runner: {
        submit: () => Promise.resolve(remote('in-progress')),
        poll: () => Promise.resolve(remote((looks += 1) > 1 ? 'success' : 'in-progress')),
      },
    })

    await manager.run({ id: 'model_scenario-llm' }, 'Assistant', {})

    // In flight AND settled: a generation is written down at both, and this is written at neither.
    expect(looks).toBeGreaterThan(1)
    expect(remembered()).toEqual([])
  })

  it('answers a failure rather than hanging on it', async () => {
    const { manager } = harness({
      runner: { submit: () => Promise.resolve(remote('failure')) },
    })

    const job = await manager.run({ id: 'model_scenario-llm' }, 'Assistant', {})

    expect(job.status).toBe('failed')
    expect(job.error).toBe('rejected')
  })

  // The bar and the journal still belong to generations: a discreet job beside one must not
  // take either away from it.
  it('leaves an ordinary generation alone beside it', async () => {
    const { manager, announced, progress } = harness({ collect: () => landing(['asset_1']) })

    manager.submit({ id: 'model_flux' }, 'Flux', {})
    await manager.run({ id: 'model_scenario-llm' }, 'Assistant', {})
    await settled()

    expect(manager.list().map(job => job.label)).toEqual(['Flux'])
    for (const list of announced) expect(list.every(job => job.label === 'Flux')).toBe(true)
    expect(progress.length).toBeGreaterThan(0)
  })
})
