import { APIError } from '@scenario-labs/sdk'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { CHANNELS } from '@shared/ipc'
import { invoke, resetHandlers } from '@main/ipc/test-harness'
import { registerScenarioHandlers } from './handlers'
import type { JobManager } from './job-manager'
import type { ModelRegistry } from './model-registry'

vi.mock('electron', async () => (await import('@main/ipc/test-harness')).mockElectron())

const LEAKY = 'Authorization: Basic YXBpX2tleTpzM2NyM3Q='

function registry(overrides: Partial<ModelRegistry> = {}): ModelRegistry {
  return {
    search: () => Promise.resolve({ items: [], cursor: null }),
    previews: () => Promise.resolve({}),
    describe: () => Promise.reject(new Error('unused')),
    invalidate: () => {},
    ...overrides,
  }
}

const jobs: JobManager = {
  submit: () => {
    throw new Error('unused')
  },
  cancel: () => Promise.resolve(),
  list: () => [],
}

describe('scenario handlers', () => {
  beforeEach(() => {
    resetHandlers()
  })

  // The same reduction the job manager applies: a rejection carries its message across, and an
  // SDK message embeds the request that produced it.
  it('reduces an SDK failure to a code rather than carrying its message across', async () => {
    const failing = APIError.generate(429, undefined, LEAKY, new Headers())
    registerScenarioHandlers({ models: registry({ search: () => Promise.reject(failing) }), jobs })

    await expect(invoke(CHANNELS.scenarioSearchModels)).rejects.toThrow('rate-limited')
    await expect(invoke(CHANNELS.scenarioSearchModels)).rejects.not.toThrow(LEAKY)
  })

  it('rejects a query asking for more than one page of models', async () => {
    const search = vi.fn(() => Promise.resolve({ items: [], cursor: null }))
    registerScenarioHandlers({ models: registry({ search }), jobs })

    await expect(invoke(CHANNELS.scenarioSearchModels, { limit: 10_000 })).rejects.toThrow()
    expect(search).not.toHaveBeenCalled()
  })

  it('reduces a describe failure the same way', async () => {
    const failing = APIError.generate(404, undefined, LEAKY, new Headers())
    registerScenarioHandlers({
      models: registry({ describe: () => Promise.reject(failing) }),
      jobs,
    })

    await expect(invoke(CHANNELS.scenarioDescribeModel, 'model_flux')).rejects.toThrow('not-found')
  })

  it('rejects a malformed model identifier before reaching the registry', async () => {
    const describe = vi.fn(() => Promise.reject(new Error('unused')))
    registerScenarioHandlers({ models: registry({ describe }), jobs })

    await expect(invoke(CHANNELS.scenarioDescribeModel, '   ')).rejects.toThrow()
    expect(describe).not.toHaveBeenCalled()
  })
})
