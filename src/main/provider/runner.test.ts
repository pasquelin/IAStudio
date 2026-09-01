import type Scenario from '@scenario-labs/sdk'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { outputsOf, runnerOf } from './runner'

/** The SDK follows a job by its own id; the target rides along for the ROUTER's sake alone. */
const TARGET = { id: 'model_flux' }

const REMOTE = { jobId: 'job_remote', status: 'queued', progress: 0, assetIds: [] }

const triggerAction = vi.fn(() => Promise.resolve({}))

/**
 * The two resources the runner touches. Narrow on purpose: standing up a whole `Scenario` to
 * prove which field is kept would prove nothing about the field.
 */
function client(runModel: () => Promise<unknown>, retrieve?: () => Promise<unknown>): Scenario {
  const stub = {
    generate: { runModel: vi.fn(runModel) },
    jobs: { retrieve: retrieve ?? (() => Promise.resolve({ job: REMOTE })), triggerAction },
  }

  // Two of the SDK's dozens of resources; the rest would be dead weight in a stub and
  // unreachable from these tests.
  return stub as unknown as Scenario
}

beforeEach(() => {
  triggerAction.mockClear()
})

describe('the assets a finished job leaves behind', () => {
  it('reads the ids a generation names', () => {
    expect(outputsOf({ ...REMOTE, metadata: { assetIds: ['asset_1'] } })).toEqual(['asset_1'])
  })

  it('answers nothing for a job the API said nothing about', () => {
    expect(outputsOf(REMOTE)).toEqual([])
    expect(outputsOf({ ...REMOTE, metadata: {} })).toEqual([])
  })
})

describe('the runner that binds the job manager to the SDK', () => {
  /**
   * The API prices the request, and the figure sits beside the job rather than inside it. Kept
   * to `.job`, as it was, it is dropped on the floor — and the polled job never says it again.
   */
  it('keeps what the submission said the request cost', async () => {
    const runner = runnerOf(client(() => Promise.resolve({ job: REMOTE, creativeUnitsCost: 12 })))

    await expect(runner.submit({ id: 'model_flux' }, { prompt: 'a rock' })).resolves.toMatchObject({
      jobId: 'job_remote',
      cost: 12,
    })
  })

  it('leaves the cost unsaid when the API priced nothing', async () => {
    const runner = runnerOf(client(() => Promise.resolve({ job: REMOTE })))

    await expect(runner.submit({ id: 'model_flux' }, {})).resolves.not.toHaveProperty('cost')
  })

  // The bar sums what it is given, and a job that reports nothing must not read as zero.
  it('carries a progress reading through, and says nothing when there is none', async () => {
    const reported = client(() => Promise.resolve({ job: { ...REMOTE, progress: 0.4 } }))
    const silent = client(() => Promise.resolve({ job: { jobId: 'job_remote', status: 'queued' } }))

    await expect(runnerOf(reported).submit({ id: 'model_flux' }, {})).resolves.toMatchObject({
      progress: 0.4,
    })
    await expect(runnerOf(silent).submit({ id: 'model_flux' }, {})).resolves.not.toHaveProperty(
      'progress',
    )
  })

  /**
   * `billing.cuCost` sits on the job itself, which is where a job resumed from a previous session
   * can still find what it cost — the submission's own figure is gone by then.
   */
  it('reads what the job says it cost when the submission said nothing', async () => {
    const priced = client(() => Promise.resolve({ job: { ...REMOTE, billing: { cuCost: 7 } } }))

    await expect(runnerOf(priced).submit({ id: 'model_flux' }, {})).resolves.toMatchObject({
      cost: 7,
    })
  })

  // And on the poll as well, which is the path a resumed job only ever takes.
  it('reads it on a poll too', async () => {
    const priced = client(
      () => Promise.resolve({ job: REMOTE }),
      () => Promise.resolve({ job: { ...REMOTE, billing: { cuCost: 7 } } }),
    )

    await expect(runnerOf(priced).poll('job_remote', TARGET)).resolves.toMatchObject({ cost: 7 })
  })

  /**
   * The job manager only emits on change, and `NaN !== NaN` walks straight through that guard —
   * one unusable figure would then emit a progress event on every poll, for ever.
   */
  it('drops a figure that cannot be drawn', async () => {
    const broken = client(() =>
      Promise.resolve({ job: { ...REMOTE, billing: { cuCost: Number.NaN } } }),
    )

    await expect(runnerOf(broken).submit({ id: 'model_flux' }, {})).resolves.not.toHaveProperty(
      'cost',
    )
  })

  // A generation that really is free says so on its own job, and that zero is a price.
  it('keeps a zero on a generation, where it means free', async () => {
    const free = client(() =>
      Promise.resolve({ job: { ...REMOTE, jobType: 'custom', billing: { cuCost: 0 } } }),
    )

    await expect(runnerOf(free).submit({ id: 'model_free' }, {})).resolves.toMatchObject({
      cost: 0,
    })
  })

  // An observed figure always wins over a declared one.
  it('keeps the submission figure over the one on the job', async () => {
    const both = client(() =>
      Promise.resolve({ job: { ...REMOTE, billing: { cuCost: 7 } }, creativeUnitsCost: 12 }),
    )

    await expect(runnerOf(both).submit({ id: 'model_flux' }, {})).resolves.toMatchObject({
      cost: 12,
    })
  })

  // Whichever endpoint started it, a job is followed and stopped through the jobs API alone.
  it('polls and cancels through the jobs endpoint, whatever ran', async () => {
    const runner = runnerOf(client(() => Promise.resolve({ job: REMOTE })))

    await expect(runner.poll('job_remote', TARGET)).resolves.toMatchObject({ jobId: 'job_remote' })

    await runner.cancel('job_remote', TARGET)
    expect(triggerAction).toHaveBeenCalledWith('job_remote', { action: 'cancel' })
  })
})
