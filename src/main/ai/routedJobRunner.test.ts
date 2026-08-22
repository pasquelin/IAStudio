import { describe, expect, it, vi } from 'vitest'
import type { JobRunner, RemoteJob } from '@main/provider/jobManager'
import type { LocalJobRunner } from './localJobRunner'
import { createRoutedJobRunner } from './routedJobRunner'

const answered = (jobId: string): RemoteJob => ({ jobId, status: 'success', assetIds: [] })

const localRunner = (): LocalJobRunner => ({
  submit: () => Promise.resolve(answered('local_1')),
  poll: jobId => Promise.resolve(answered(jobId)),
  cancel: () => Promise.resolve(),
  outputOf: () => null,
  owns: jobId => jobId.startsWith('local_'),
})

const cloudRunner = (): JobRunner => ({
  submit: () => Promise.resolve(answered('job_1')),
  poll: jobId => Promise.resolve(answered(jobId)),
  cancel: () => Promise.resolve(),
})

describe('the routed job runner', () => {
  /**
   * ADR-21 as amended: nothing switches "to the cloud" — a model is chosen, and the model knows
   * where it runs. This is that sentence as routing.
   */
  it('sends a target to the side that holds it, and follows its job there', async () => {
    const local = localRunner()
    const cloud = cloudRunner()
    const localPoll = vi.spyOn(local, 'poll')
    const cloudPoll = vi.spyOn(cloud, 'poll')

    const runner = createRoutedJobRunner({
      local,
      cloud: () => cloud,
      isLocalTarget: id => id === 'local_model',
    })

    expect((await runner.submit({ id: 'local_model' }, {})).jobId).toBe('local_1')
    expect((await runner.submit({ id: 'model_flux' }, {})).jobId).toBe('job_1')

    await runner.poll('local_1')
    await runner.poll('job_1')
    expect(localPoll).toHaveBeenCalledOnce()
    expect(cloudPoll).toHaveBeenCalledOnce()
  })

  /**
   * A generation on this machine needs no account, and asking for one that does without a key is
   * a readable refusal — rejected rather than thrown, because the manager awaits these and a
   * synchronous throw would escape the retry meant to word the failure.
   */
  it('runs on this machine with no account, and says why a cloud target cannot', async () => {
    const runner = createRoutedJobRunner({
      local: localRunner(),
      cloud: () => null,
      isLocalTarget: id => id === 'local_model',
    })

    await expect(runner.submit({ id: 'local_model' }, {})).resolves.toMatchObject({
      jobId: 'local_1',
    })
    await expect(runner.submit({ id: 'model_flux' }, {})).rejects.toThrow(/no account/)
  })
})
