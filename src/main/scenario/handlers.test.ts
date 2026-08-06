import { APIError } from '@scenario-labs/sdk'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { CHANNELS } from '@shared/ipc'
import { registerScenarioHandlers } from './handlers'
import type { JobManager } from './job-manager'
import type { ModelRegistry } from './model-registry'

type Invoke = (...args: unknown[]) => unknown

const { registered } = vi.hoisted(() => ({ registered: new Map<string, Invoke>() }))

vi.mock('electron', () => ({
  ipcMain: {
    handle: (channel: string, handler: Invoke) => void registered.set(channel, handler),
  },
}))

function invoke(channel: string, ...args: unknown[]): unknown {
  const handler = registered.get(channel)
  if (!handler) throw new Error(`no handler registered for ${channel}`)
  return handler({}, ...args)
}

const LEAKY = 'Authorization: Basic YXBpX2tleTpzM2NyM3Q='

function registry(overrides: Partial<ModelRegistry> = {}): ModelRegistry {
  return {
    list: () => Promise.resolve([]),
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
    registered.clear()
  })

  // The same reduction the job manager applies: a rejection carries its message across, and an
  // SDK message embeds the request that produced it.
  it('reduces an SDK failure to a code rather than carrying its message across', async () => {
    const failing = APIError.generate(429, undefined, LEAKY, new Headers())
    registerScenarioHandlers({ models: registry({ list: () => Promise.reject(failing) }), jobs })

    await expect(invoke(CHANNELS.scenarioListModels)).rejects.toThrow('rate-limited')
    await expect(invoke(CHANNELS.scenarioListModels)).rejects.not.toThrow(LEAKY)
  })

  it('reduces a describe failure the same way', async () => {
    const failing = APIError.generate(404, undefined, LEAKY, new Headers())
    registerScenarioHandlers({
      models: registry({ describe: () => Promise.reject(failing) }),
      jobs,
    })

    await expect(invoke(CHANNELS.scenarioDescribeModel, 'model_flux')).rejects.toThrow('unexpected')
  })

  it('rejects a malformed model identifier before reaching the registry', async () => {
    const describe = vi.fn(() => Promise.reject(new Error('unused')))
    registerScenarioHandlers({ models: registry({ describe }), jobs })

    await expect(invoke(CHANNELS.scenarioDescribeModel, '   ')).rejects.toThrow()
    expect(describe).not.toHaveBeenCalled()
  })
})
