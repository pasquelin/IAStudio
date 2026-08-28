import { describe, expect, it, vi } from 'vitest'
import type { JobRunner, RemoteJob } from '@main/provider/jobManager'
import { cloudModelId } from '@shared/domain/codeGeneration'
import type { CodeJobRunner } from './codeJobRunner'
import type { LocalJobRunner } from './localJobRunner'
import { createRoutedJobRunner } from './routedJobRunner'

const answered = (jobId: string): RemoteJob => ({ jobId, status: 'success', assetIds: [] })

/** A runner that answers under its own prefix — which is the only thing routing turns on. */
const runnerOf = (prefix: string) => ({
  submit: () => Promise.resolve(answered(`${prefix}1`)),
  poll: (jobId: string) => Promise.resolve(answered(jobId)),
  cancel: () => Promise.resolve(),
  owns: (jobId: string) => jobId.startsWith(prefix),
})

const localRunner = (): LocalJobRunner => ({
  ...runnerOf('local_'),
  outputOf: () => null,
  producedBy: () => null,
})

const codeRunner = (): CodeJobRunner => runnerOf('code_')

const cloudRunner = (): JobRunner => runnerOf('job_')

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
      code: codeRunner(),
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
   * 🛑 Before `isLocalTarget`, and it has to be: a chat cloud is not on this machine and is not
   * Scenario either. Routed by the id alone, a script would have gone to the catalogue.
   */
  it('sends a script to the chat that writes one, with no account of Scenario held', async () => {
    const code = codeRunner()
    const codePoll = vi.spyOn(code, 'poll')

    const runner = createRoutedJobRunner({
      local: localRunner(),
      code,
      cloud: () => null,
      isLocalTarget: () => false,
    })

    expect((await runner.submit({ id: cloudModelId('anthropic') }, {})).jobId).toBe('code_1')

    await runner.poll('code_1')
    expect(codePoll).toHaveBeenCalledOnce()
  })

  /**
   * A generation on this machine needs no account, and asking for one that does without a key is
   * a readable refusal — rejected rather than thrown, because the manager awaits these and a
   * synchronous throw would escape the retry meant to word the failure.
   */
  it('runs on this machine with no account, and says why a cloud target cannot', async () => {
    const runner = createRoutedJobRunner({
      local: localRunner(),
      code: codeRunner(),
      cloud: () => null,
      isLocalTarget: id => id === 'local_model',
    })

    await expect(runner.submit({ id: 'local_model' }, {})).resolves.toMatchObject({
      jobId: 'local_1',
    })
    await expect(runner.submit({ id: 'model_flux' }, {})).rejects.toThrow(/no account/)
  })
})
