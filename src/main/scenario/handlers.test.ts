import { APIError } from '@scenario-labs/sdk'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { CHANNELS } from '@shared/ipc'
import { PROMPT_INPUT_MAX, PROMPT_SUGGESTIONS_MAX } from '@shared/domain/prompt-assist'
import { invoke, resetHandlers } from '@main/ipc/test-harness'
import { registerScenarioHandlers } from './handlers'
import type { AssetUploader } from './uploader'
import type { JobManager } from './job-manager'
import type { ModelRegistry } from './model-registry'
import type { PromptAssist } from './prompt-assist'

vi.mock('electron', async () => (await import('@main/ipc/test-harness')).mockElectron())

const LEAKY = 'Authorization: Basic YXBpX2tleTpzM2NyM3Q='

function registry(overrides: Partial<ModelRegistry> = {}): ModelRegistry {
  return {
    search: () => Promise.resolve({ items: [], cursor: null }),
    previews: () => Promise.resolve({}),
    describe: () => Promise.reject(new Error('unused')),
    ...overrides,
  }
}

const uploads: AssetUploader = {
  upload: () => Promise.resolve('asset-1'),
}

const jobs: JobManager = {
  submit: () => {
    throw new Error('unused')
  },
  cancel: () => Promise.resolve(),
  list: () => [],
}

function assistant(overrides: Partial<PromptAssist> = {}): PromptAssist {
  return {
    suggest: () => Promise.reject(new Error('unused')),
    translate: () => Promise.reject(new Error('unused')),
    ...overrides,
  }
}

const prompts = assistant()

describe('scenario handlers', () => {
  beforeEach(() => {
    resetHandlers()
  })

  // The same reduction the job manager applies: a rejection carries its message across, and an
  // SDK message embeds the request that produced it.
  it('reduces an SDK failure to a code rather than carrying its message across', async () => {
    const failing = APIError.generate(429, undefined, LEAKY, new Headers())
    registerScenarioHandlers({
      models: registry({ search: () => Promise.reject(failing) }),
      jobs,
      prompts,
      uploads,
    })

    await expect(invoke(CHANNELS.scenarioSearchModels)).rejects.toThrow('rate-limited')
    await expect(invoke(CHANNELS.scenarioSearchModels)).rejects.not.toThrow(LEAKY)
  })

  it('rejects a query asking for more than one page of models', async () => {
    const search = vi.fn(() => Promise.resolve({ items: [], cursor: null }))
    registerScenarioHandlers({ models: registry({ search }), jobs, prompts, uploads })

    await expect(invoke(CHANNELS.scenarioSearchModels, { limit: 10_000 })).rejects.toThrow()
    expect(search).not.toHaveBeenCalled()
  })

  it('reduces a describe failure the same way', async () => {
    const failing = APIError.generate(404, undefined, LEAKY, new Headers())
    registerScenarioHandlers({
      models: registry({ describe: () => Promise.reject(failing) }),
      jobs,
      prompts,
      uploads,
    })

    await expect(invoke(CHANNELS.scenarioDescribeModel, 'model_flux')).rejects.toThrow('not-found')
  })

  it('rejects a malformed model identifier before reaching the registry', async () => {
    const describe = vi.fn(() => Promise.reject(new Error('unused')))
    registerScenarioHandlers({ models: registry({ describe }), jobs, prompts, uploads })

    await expect(invoke(CHANNELS.scenarioDescribeModel, '   ')).rejects.toThrow()
    expect(describe).not.toHaveBeenCalled()
  })

  describe('prompt suggestions', () => {
    it('passes the request through once it is valid', async () => {
      const suggest = vi.fn(() => Promise.resolve([{ text: 'rewritten', parameters: {} }]))
      registerScenarioHandlers({
        models: registry(),
        jobs,
        prompts: assistant({ suggest }),
        uploads,
      })

      await expect(
        invoke(CHANNELS.scenarioSuggestPrompts, { modelId: 'model_flux', prompt: 'a boulder' }),
      ).resolves.toEqual([{ text: 'rewritten', parameters: {} }])
      expect(suggest).toHaveBeenCalledWith({ modelId: 'model_flux', prompt: 'a boulder' })
    })

    it('refuses a request without a model', async () => {
      const suggest = vi.fn(() => Promise.reject(new Error('unused')))
      registerScenarioHandlers({
        models: registry(),
        jobs,
        prompts: assistant({ suggest }),
        uploads,
      })

      await expect(
        invoke(CHANNELS.scenarioSuggestPrompts, { prompt: 'a boulder' }),
      ).rejects.toThrow()
      expect(suggest).not.toHaveBeenCalled()
    })

    // The channel answers with a handful of sentences; it is not a way to push a megabyte
    // through the boundary.
    it('refuses a draft longer than the boundary accepts', async () => {
      const suggest = vi.fn(() => Promise.reject(new Error('unused')))
      registerScenarioHandlers({
        models: registry(),
        jobs,
        prompts: assistant({ suggest }),
        uploads,
      })

      await expect(
        invoke(CHANNELS.scenarioSuggestPrompts, {
          modelId: 'model_flux',
          prompt: 'x'.repeat(PROMPT_INPUT_MAX + 1),
        }),
      ).rejects.toThrow()
      expect(suggest).not.toHaveBeenCalled()
    })

    it('refuses to ask for more variants than the API accepts', async () => {
      const suggest = vi.fn(() => Promise.reject(new Error('unused')))
      registerScenarioHandlers({
        models: registry(),
        jobs,
        prompts: assistant({ suggest }),
        uploads,
      })

      await expect(
        invoke(CHANNELS.scenarioSuggestPrompts, {
          modelId: 'model_flux',
          numResults: PROMPT_SUGGESTIONS_MAX + 1,
        }),
      ).rejects.toThrow()
      expect(suggest).not.toHaveBeenCalled()
    })

    it('reduces a refused suggestion to a code like every other call', async () => {
      const failing = APIError.generate(429, undefined, LEAKY, new Headers())
      registerScenarioHandlers({
        models: registry(),
        jobs,
        prompts: assistant({ suggest: () => Promise.reject(failing) }),
        uploads,
      })

      const refused = invoke(CHANNELS.scenarioSuggestPrompts, { modelId: 'model_flux' })

      await expect(refused).rejects.toThrow('rate-limited')
    })
  })
})
