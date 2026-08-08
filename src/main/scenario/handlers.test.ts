import { APIError } from '@scenario-labs/sdk'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { CHANNELS } from '@shared/ipc'
import {
  PROMPT_IMAGES_MAX,
  PROMPT_INPUT_MAX,
  PROMPT_SUGGESTIONS_MAX,
} from '@shared/domain/prompt-assist'
import { invoke, resetHandlers } from '@main/ipc/test-harness'
import { registerScenarioHandlers } from './handlers'
import type { AssetUploader } from './uploader'
import type { JobManager } from './job-manager'
import type { ModelRegistry } from './model-registry'
import type { PromptAssist } from './prompt-assist'
import type { UsageReader } from './usage'

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
    describeStyle: () => Promise.reject(new Error('unused')),
    caption: () => Promise.reject(new Error('unused')),
    ...overrides,
  }
}

const prompts = assistant()

function reader(overrides: Partial<UsageReader> = {}): UsageReader {
  return {
    report: () => Promise.reject(new Error('unused')),
    events: () => Promise.reject(new Error('unused')),
    ...overrides,
  }
}

const usage = reader()

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
      usage,
    })

    await expect(invoke(CHANNELS.scenarioSearchModels)).rejects.toThrow('rate-limited')
    await expect(invoke(CHANNELS.scenarioSearchModels)).rejects.not.toThrow(LEAKY)
  })

  it('rejects a query asking for more than one page of models', async () => {
    const search = vi.fn(() => Promise.resolve({ items: [], cursor: null }))
    registerScenarioHandlers({ models: registry({ search }), jobs, prompts, uploads, usage })

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
      usage,
    })

    await expect(invoke(CHANNELS.scenarioDescribeModel, 'model_flux')).rejects.toThrow('not-found')
  })

  it('rejects a malformed model identifier before reaching the registry', async () => {
    const describe = vi.fn(() => Promise.reject(new Error('unused')))
    registerScenarioHandlers({ models: registry({ describe }), jobs, prompts, uploads, usage })

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
        usage,
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
        usage,
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
        usage,
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
        usage,
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
        usage,
      })

      const refused = invoke(CHANNELS.scenarioSuggestPrompts, { modelId: 'model_flux' })

      await expect(refused).rejects.toThrow('rate-limited')
    })
  })

  describe('translating a draft', () => {
    it('passes a valid draft through', async () => {
      const translate = vi.fn(() =>
        Promise.resolve({ text: 'a mossy boulder', detectedLanguage: 'french' }),
      )
      registerScenarioHandlers({
        models: registry(),
        jobs,
        prompts: assistant({ translate }),
        uploads,
        usage,
      })

      await expect(invoke(CHANNELS.scenarioTranslatePrompt, 'un rocher moussu')).resolves.toEqual({
        text: 'a mossy boulder',
        detectedLanguage: 'french',
      })
      expect(translate).toHaveBeenCalledWith('un rocher moussu')
    })

    it('refuses blank text, which has nothing to translate', async () => {
      const translate = vi.fn(() => Promise.reject(new Error('unused')))
      registerScenarioHandlers({
        models: registry(),
        jobs,
        prompts: assistant({ translate }),
        uploads,
        usage,
      })

      await expect(invoke(CHANNELS.scenarioTranslatePrompt, '   ')).rejects.toThrow()
      expect(translate).not.toHaveBeenCalled()
    })
  })

  describe('describing a style', () => {
    it('passes the references through', async () => {
      const describeStyle = vi.fn(() =>
        Promise.resolve({ description: 'muted greens', synthesis: 'two pictures' }),
      )
      registerScenarioHandlers({
        models: registry(),
        jobs,
        prompts: assistant({ describeStyle }),
        uploads,
        usage,
      })

      await expect(
        invoke(CHANNELS.scenarioDescribeStyle, ['asset_one', 'asset_two']),
      ).resolves.toEqual({ description: 'muted greens', synthesis: 'two pictures' })
      expect(describeStyle).toHaveBeenCalledWith(['asset_one', 'asset_two'])
    })

    it('refuses an empty list, which shows nothing to read', async () => {
      const describeStyle = vi.fn(() => Promise.reject(new Error('unused')))
      registerScenarioHandlers({
        models: registry(),
        jobs,
        prompts: assistant({ describeStyle }),
        uploads,
        usage,
      })

      await expect(invoke(CHANNELS.scenarioDescribeStyle, [])).rejects.toThrow()
      expect(describeStyle).not.toHaveBeenCalled()
    })

    it('refuses more references than the API accepts', async () => {
      const describeStyle = vi.fn(() => Promise.reject(new Error('unused')))
      registerScenarioHandlers({
        models: registry(),
        jobs,
        prompts: assistant({ describeStyle }),
        uploads,
        usage,
      })

      const tooMany = Array.from({ length: PROMPT_IMAGES_MAX + 1 }, (_unused, at) => `asset_${at}`)

      await expect(invoke(CHANNELS.scenarioDescribeStyle, tooMany)).rejects.toThrow()
      expect(describeStyle).not.toHaveBeenCalled()
    })
  })

  describe('usage', () => {
    const EMPTY_PAGE = { events: [], cursors: {}, more: false }

    it('passes a period the API accepts straight through', async () => {
      const report = vi.fn(() => Promise.reject(new Error('unused')))
      registerScenarioHandlers({
        models: registry(),
        jobs,
        prompts,
        uploads,
        usage: reader({ report }),
      })

      await expect(invoke(CHANNELS.scenarioUsageReport, 31)).rejects.toThrow()
      expect(report).toHaveBeenCalledWith(31)
    })

    // 120 days is the API's ceiling; anything else is a caller inventing a window.
    it('refuses a period the API does not offer', async () => {
      const report = vi.fn(() => Promise.reject(new Error('unused')))
      registerScenarioHandlers({
        models: registry(),
        jobs,
        prompts,
        uploads,
        usage: reader({ report }),
      })

      await expect(invoke(CHANNELS.scenarioUsageReport, 45)).rejects.toThrow()
      expect(report).not.toHaveBeenCalled()
    })

    it('pages the log from the cursors it is given and refuses a nonsensical one', async () => {
      const events = vi.fn(() => Promise.resolve(EMPTY_PAGE))
      registerScenarioHandlers({
        models: registry(),
        jobs,
        prompts,
        uploads,
        usage: reader({ events }),
      })

      const cursors = { 'acc-1': 100 }
      await expect(invoke(CHANNELS.scenarioUsageEvents, 7, cursors)).resolves.toEqual(EMPTY_PAGE)
      expect(events).toHaveBeenCalledWith(7, cursors)

      await expect(invoke(CHANNELS.scenarioUsageEvents, 7, { 'acc-1': -1 })).rejects.toThrow()
      await expect(invoke(CHANNELS.scenarioUsageEvents, 7, 100)).rejects.toThrow()
    })

    it('reduces a refused usage call to a code like every other channel', async () => {
      const failing = APIError.generate(429, undefined, LEAKY, new Headers())
      registerScenarioHandlers({
        models: registry(),
        jobs,
        prompts,
        uploads,
        usage: reader({ report: () => Promise.reject(failing) }),
      })

      const refused = invoke(CHANNELS.scenarioUsageReport, 31)

      await expect(refused).rejects.toThrow('rate-limited')
      await expect(refused).rejects.not.toThrow(LEAKY)
    })
  })
})
