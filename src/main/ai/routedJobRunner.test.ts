import { describe, expect, it, vi } from 'vitest'
import type { JobRunner, RemoteJob } from '@main/provider/jobManager'
import { cloudModelId } from '@shared/domain/codeGeneration'
import { TRIPO_CATALOGUE, tripoModelId } from '@shared/domain/tripo'
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

const tripoRunner = (): JobRunner => runnerOf('tripo_')

/** Whichever entry the catalogue opens on: what routing turns on is the PREFIX, not the entry. */
const anyTripoTarget = TRIPO_CATALOGUE.map(tripoModelId)[0] ?? ''

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
      tripo: () => null,
      cloud: () => cloud,
      isLocalTarget: id => id === 'local_model',
    })

    expect((await runner.submit({ id: 'local_model' }, {})).jobId).toBe('local_1')
    expect((await runner.submit({ id: 'model_flux' }, {})).jobId).toBe('job_1')

    await runner.poll('local_1', { id: 'local_model' })
    await runner.poll('job_1', { id: 'model_flux' })
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
      tripo: () => null,
      cloud: () => null,
      isLocalTarget: () => false,
    })

    expect((await runner.submit({ id: cloudModelId('anthropic') }, {})).jobId).toBe('code_1')

    await runner.poll('code_1', { id: cloudModelId('anthropic') })
    expect(codePoll).toHaveBeenCalledOnce()
  })

  /**
   * The second cloud that generates. Routed by the TARGET and never by the job id: a Tripo task
   * is named by a bare UUID, which nothing tells apart from any other id after a relaunch.
   */
  it('sends a Tripo target to Tripo, and follows a resumed task there too', async () => {
    const tripo = tripoRunner()
    const cloud = cloudRunner()
    const tripoPoll = vi.spyOn(tripo, 'poll')

    const runner = createRoutedJobRunner({
      local: localRunner(),
      code: codeRunner(),
      tripo: () => tripo,
      cloud: () => cloud,
      isLocalTarget: () => false,
    })

    expect((await runner.submit({ id: anyTripoTarget }, {})).jobId).toBe('tripo_1')

    // An id this runner has never minted — what a session picking up yesterday's job holds.
    await runner.poll('9a1c5248-e08c', { id: anyTripoTarget })
    expect(tripoPoll).toHaveBeenCalledWith('9a1c5248-e08c', { id: anyTripoTarget })
  })

  it('says why a Tripo target cannot run with no key held for it', async () => {
    const runner = createRoutedJobRunner({
      local: localRunner(),
      code: codeRunner(),
      tripo: () => null,
      cloud: () => cloudRunner(),
      isLocalTarget: () => false,
    })

    await expect(runner.submit({ id: anyTripoTarget }, {})).rejects.toThrow(/no account/)
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
      tripo: () => null,
      cloud: () => null,
      isLocalTarget: id => id === 'local_model',
    })

    await expect(runner.submit({ id: 'local_model' }, {})).resolves.toMatchObject({
      jobId: 'local_1',
    })
    await expect(runner.submit({ id: 'model_flux' }, {})).rejects.toThrow(/no account/)
  })
})

/**
 * 🛑 The manager releases a settled job through the ROUTED runner. Absent here, the optional
 * call was swallowed: every runner's own `forget` was dead code, and the one that keeps a prompt
 * per submission kept them for the life of the process.
 */
describe('releasing a settled job', () => {
  it('reaches the runner that owns the target', () => {
    const tripo = { ...tripoRunner(), forget: vi.fn() }
    const runner = createRoutedJobRunner({
      local: localRunner(),
      code: codeRunner(),
      tripo: () => tripo,
      cloud: () => cloudRunner(),
      isLocalTarget: () => false,
    })

    runner.forget?.('9a1c-5248', { id: anyTripoTarget })

    expect(tripo.forget).toHaveBeenCalledWith('9a1c-5248', { id: anyTripoTarget })
  })

  // Nothing to release, and nothing to throw over: a job whose account went away is settled too.
  it('says nothing when no account is held for the target any more', () => {
    const runner = createRoutedJobRunner({
      local: localRunner(),
      code: codeRunner(),
      tripo: () => null,
      cloud: () => null,
      isLocalTarget: () => false,
    })

    expect(() => runner.forget?.('9a1c-5248', { id: anyTripoTarget })).not.toThrow()
  })
})
