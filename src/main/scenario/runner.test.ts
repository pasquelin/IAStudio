import type Scenario from '@scenario-labs/sdk'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { outputsOf, runnerOf } from './runner'

const REMOTE = { jobId: 'job_remote', status: 'queued', progress: 0, assetIds: [] }

const triggerAction = vi.fn(() => Promise.resolve({}))

/**
 * The three resources the runner touches. Narrow on purpose: standing up a whole `Scenario` to
 * prove which field is kept would prove nothing about the field.
 */
function client(
  runModel: () => Promise<unknown>,
  runWorkflow?: () => Promise<unknown>,
  retrieve?: () => Promise<unknown>,
): Scenario {
  const stub = {
    generate: { runModel: vi.fn(runModel) },
    workflows: { run: vi.fn(runWorkflow ?? (() => Promise.resolve({ job: REMOTE }))) },
    jobs: { retrieve: retrieve ?? (() => Promise.resolve({ job: REMOTE })), triggerAction },
  }

  // Three of the SDK's dozens of resources; the rest would be dead weight in a stub and
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

  /**
   * A workflow job says nothing in `assetIds` — it reports node by node, and the API includes
   * only the last nodes unless one asks otherwise. Unread, the outputs of every App would land
   * nowhere: the job would succeed with an empty project behind it.
   */
  it('flattens what the nodes of a workflow produced', () => {
    const payload = {
      ...REMOTE,
      metadata: {
        flow: [{ assets: [{ assetId: 'asset_mask' }] }, { assets: [{ assetId: 'asset_final' }] }],
      },
    }

    expect(outputsOf(payload)).toEqual(['asset_mask', 'asset_final'])
  })

  // A logic node, a transform, an approval: plenty of nodes produce no asset at all.
  it('skips the nodes that produced nothing', () => {
    const payload = { ...REMOTE, metadata: { flow: [{}, { assets: [{ assetId: 'asset_1' }] }] } }

    expect(outputsOf(payload)).toEqual(['asset_1'])
  })

  // The same asset would otherwise be fetched, filed and charged for twice.
  it('never names the same asset twice', () => {
    const twice = [{ assets: [{ assetId: 'asset_1' }] }, { assets: [{ assetId: 'asset_1' }] }]

    expect(outputsOf({ ...REMOTE, metadata: { flow: twice } })).toEqual(['asset_1'])
  })

  /** Both would import every intermediate picture of a pipeline as if it were a result. */
  it('prefers what the job names over what its nodes produced', () => {
    const payload = {
      ...REMOTE,
      metadata: {
        assetIds: ['asset_final'],
        flow: [{ assets: [{ assetId: 'asset_intermediate' }] }],
      },
    }

    expect(outputsOf(payload)).toEqual(['asset_final'])
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

    await expect(
      runner.submit({ kind: 'model', id: 'model_flux' }, { prompt: 'a rock' }),
    ).resolves.toMatchObject({
      jobId: 'job_remote',
      cost: 12,
    })
  })

  it('leaves the cost unsaid when the API priced nothing', async () => {
    const runner = runnerOf(client(() => Promise.resolve({ job: REMOTE })))

    await expect(
      runner.submit({ kind: 'model', id: 'model_flux' }, {}),
    ).resolves.not.toHaveProperty('cost')
  })

  /** Two endpoints, and only the kind says which one runs — a workflow id is not a model id. */
  it('runs a workflow through the workflow endpoint', async () => {
    const runModel = vi.fn(() => Promise.resolve({ job: REMOTE }))
    const runWorkflow = vi.fn(() => Promise.resolve({ job: REMOTE, workflow: { id: 'w' } }))
    const runner = runnerOf(client(runModel, runWorkflow))

    await expect(
      runner.submit({ kind: 'workflow', id: 'workflow_1' }, { image: 'asset_1' }),
    ).resolves.toMatchObject({ jobId: 'job_remote' })

    expect(runWorkflow).toHaveBeenCalledWith('workflow_1', { body: { image: 'asset_1' } })
    expect(runModel).not.toHaveBeenCalled()
  })

  // Both endpoints report progress the same way, and the bar sums what it is given.
  it('carries a progress reading through, and says nothing when there is none', async () => {
    const generation = client(() => Promise.resolve({ job: { ...REMOTE, progress: 0.4 } }))
    const workflow = client(
      () => Promise.resolve({ job: REMOTE }),
      () => Promise.resolve({ job: { jobId: 'job_remote', status: 'queued' } }),
    )

    await expect(
      runnerOf(generation).submit({ kind: 'model', id: 'model_flux' }, {}),
    ).resolves.toMatchObject({ progress: 0.4 })
    await expect(
      runnerOf(workflow).submit({ kind: 'workflow', id: 'workflow_1' }, {}),
    ).resolves.not.toHaveProperty('progress')
  })

  /**
   * The doubt `REPRISE.md` § 4 left open: both references declare `billing.cuCost` on the job
   * itself, and nothing had ever been read from it. A workflow prices nothing beside its job,
   * so this is the only figure an App could show — when the API fills it in, which for a
   * workflow it was observed not to. See the two tests below.
   */
  it('reads what the job says it cost when the submission said nothing', async () => {
    const priced = client(
      () => Promise.resolve({ job: REMOTE }),
      () => Promise.resolve({ job: { ...REMOTE, billing: { cuCost: 7 } } }),
    )

    await expect(
      runnerOf(priced).submit({ kind: 'workflow', id: 'workflow_1' }, {}),
    ).resolves.toMatchObject({ cost: 7 })
  })

  /**
   * Observed on 9 August 2026: the parent of a two-node App answered `cuCost: 0` while the node
   * it ran answered 12. Zero on a pipeline is where the charge is not, never what it cost.
   */
  it('shows no cost for a workflow job that bills nothing itself', async () => {
    const parent = client(
      () => Promise.resolve({ job: REMOTE }),
      () => Promise.resolve({ job: { ...REMOTE, jobType: 'workflow', billing: { cuCost: 0 } } }),
    )

    await expect(
      runnerOf(parent).submit({ kind: 'workflow', id: 'workflow_1' }, {}),
    ).resolves.not.toHaveProperty('cost')
  })

  // And on the poll as well, which is the path a resumed App only ever takes.
  it('shows no cost for a workflow job polled after the session that ran it', async () => {
    const parent = client(
      () => Promise.resolve({ job: REMOTE }),
      undefined,
      () => Promise.resolve({ job: { ...REMOTE, jobType: 'workflow', billing: { cuCost: 0 } } }),
    )

    await expect(runnerOf(parent).poll('job_remote')).resolves.not.toHaveProperty('cost')
  })

  // The day the API does charge the parent, the figure is shown: only the zero is read as absence.
  it('shows a workflow cost the API does fill in', async () => {
    const parent = client(
      () => Promise.resolve({ job: REMOTE }),
      () => Promise.resolve({ job: { ...REMOTE, jobType: 'workflow', billing: { cuCost: 30 } } }),
    )

    await expect(
      runnerOf(parent).submit({ kind: 'workflow', id: 'workflow_1' }, {}),
    ).resolves.toMatchObject({ cost: 30 })
  })

  /**
   * The job manager only emits on change, and `NaN !== NaN` walks straight through that guard —
   * one unusable figure would then emit a progress event on every poll, for ever.
   */
  it('drops a figure that cannot be drawn', async () => {
    const broken = client(() =>
      Promise.resolve({ job: { ...REMOTE, billing: { cuCost: Number.NaN } } }),
    )

    await expect(
      runnerOf(broken).submit({ kind: 'model', id: 'model_flux' }, {}),
    ).resolves.not.toHaveProperty('cost')
  })

  // A generation that really is free says so on its own job, and that zero is a price.
  it('keeps a zero on a generation, where it means free', async () => {
    const free = client(() =>
      Promise.resolve({ job: { ...REMOTE, jobType: 'custom', billing: { cuCost: 0 } } }),
    )

    await expect(
      runnerOf(free).submit({ kind: 'model', id: 'model_free' }, {}),
    ).resolves.toMatchObject({ cost: 0 })
  })

  // An observed figure always wins over a declared one.
  it('keeps the submission figure over the one on the job', async () => {
    const both = client(() =>
      Promise.resolve({ job: { ...REMOTE, billing: { cuCost: 7 } }, creativeUnitsCost: 12 }),
    )

    await expect(
      runnerOf(both).submit({ kind: 'model', id: 'model_flux' }, {}),
    ).resolves.toMatchObject({ cost: 12 })
  })

  // Whichever endpoint started it, a job is followed and stopped through the jobs API alone.
  it('polls and cancels through the jobs endpoint, whatever ran', async () => {
    const runner = runnerOf(client(() => Promise.resolve({ job: REMOTE })))

    await expect(runner.poll('job_remote')).resolves.toMatchObject({ jobId: 'job_remote' })

    await runner.cancel('job_remote')
    expect(triggerAction).toHaveBeenCalledWith('job_remote', { action: 'cancel' })
  })
})
