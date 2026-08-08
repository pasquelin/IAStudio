import type Scenario from '@scenario-labs/sdk'
import { describe, expect, it, vi } from 'vitest'
import { runnerOf } from './runner'

const REMOTE = { jobId: 'job_remote', status: 'queued', progress: 0 }

/**
 * The two calls the runner reads a response apart on. Narrow on purpose: standing up a whole
 * `Scenario` to prove which field is kept would prove nothing about the field.
 */
function client(runModel: () => Promise<unknown>): Scenario {
  const stub = {
    generate: { runModel: vi.fn(runModel) },
    jobs: { retrieve: () => Promise.resolve({ job: REMOTE }) },
  }

  // The runner touches two of the SDK's dozens of resources; the rest would be dead weight in
  // a stub and unreachable from these tests.
  return stub as unknown as Scenario
}

describe('the runner that binds the job manager to the SDK', () => {
  /**
   * The API prices the request, and the figure sits beside the job rather than inside it. Kept
   * to `.job`, as it was, it is dropped on the floor — and the polled job never says it again.
   */
  it('keeps what the submission said the request cost', async () => {
    const runner = runnerOf(client(() => Promise.resolve({ job: REMOTE, creativeUnitsCost: 12 })))

    await expect(runner.submit('model_flux', { prompt: 'a rock' })).resolves.toMatchObject({
      jobId: 'job_remote',
      cost: 12,
    })
  })

  it('leaves the cost unsaid when the API priced nothing', async () => {
    const runner = runnerOf(client(() => Promise.resolve({ job: REMOTE })))

    await expect(runner.submit('model_flux', {})).resolves.not.toHaveProperty('cost')
  })
})
