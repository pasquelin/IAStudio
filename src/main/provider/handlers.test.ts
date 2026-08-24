import { APIError } from '@scenario-labs/sdk'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { CHANNELS } from '@shared/ipc'
import {
  PROMPT_IMAGES_MAX,
  PROMPT_INPUT_MAX,
  PROMPT_SUGGESTIONS_MAX,
} from '@shared/domain/promptAssist'
import { invoke, resetHandlers } from '@main/ipc/testHarness'
import { registerProviderHandlers, type ProviderHandlerDeps } from './handlers'
import type { AssetUploader } from './uploader'
import type { Job } from '@shared/domain/job'
import type { JobManager } from './jobManager'
import type { ModelRegistry } from './modelRegistry'
import type { PromptAssist } from './promptAssist'
import type { PromptContext } from './promptContext'
import type { CostEstimator } from './cost'
import type { UsageReader } from './usage'

vi.mock('electron', async () => (await import('@main/ipc/testHarness')).mockElectron())

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
  run: () => Promise.reject(new Error('unused')),
  cancel: () => Promise.resolve(),
  list: () => [],
  resume: () => {},
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

const estimateCost: CostEstimator = () => Promise.resolve(null)

/** Adds nothing unless a case says otherwise: most generations carry no project context. */
const promptContext: PromptContext = body => Promise.resolve({ body, authored: null })

/** Every dependency stubbed, so a case names only the one it is about. */
function register(overrides: Partial<ProviderHandlerDeps> = {}): void {
  registerProviderHandlers({
    models: registry(),
    jobs,
    prompts,
    uploads,
    usage,
    plan: { access: () => Promise.resolve(null) },
    estimateCost,
    promptContext,
    ...overrides,
  })
}

describe('scenario handlers', () => {
  beforeEach(() => {
    resetHandlers()
  })

  // The same reduction the job manager applies: a rejection carries its message across, and an
  // SDK message embeds the request that produced it.
  it('reduces an SDK failure to a code rather than carrying its message across', async () => {
    const failing = APIError.generate(429, undefined, LEAKY, new Headers())
    register({
      models: registry({ search: () => Promise.reject(failing) }),
    })

    await expect(invoke(CHANNELS.providerSearchModels)).rejects.toThrow('rate-limited')
    await expect(invoke(CHANNELS.providerSearchModels)).rejects.not.toThrow(LEAKY)
  })

  it('rejects a query asking for more than one page of models', async () => {
    const search = vi.fn(() => Promise.resolve({ items: [], cursor: null }))
    register({
      models: registry({ search }),
    })

    await expect(invoke(CHANNELS.providerSearchModels, { limit: 10_000 })).rejects.toThrow()
    expect(search).not.toHaveBeenCalled()
  })

  it('reduces a describe failure the same way', async () => {
    const failing = APIError.generate(404, undefined, LEAKY, new Headers())
    register({
      models: registry({ describe: () => Promise.reject(failing) }),
    })

    await expect(invoke(CHANNELS.providerDescribeModel, 'model_flux')).rejects.toThrow('not-found')
  })

  it('rejects a malformed model identifier before reaching the registry', async () => {
    const describe = vi.fn(() => Promise.reject(new Error('unused')))
    register({
      models: registry({ describe }),
    })

    await expect(invoke(CHANNELS.providerDescribeModel, '   ')).rejects.toThrow()
    expect(describe).not.toHaveBeenCalled()
  })

  describe('prompt suggestions', () => {
    it('passes the request through once it is valid', async () => {
      const suggest = vi.fn(() => Promise.resolve([{ text: 'rewritten', parameters: {} }]))
      register({
        prompts: assistant({ suggest }),
      })

      await expect(
        invoke(CHANNELS.providerSuggestPrompts, { modelId: 'model_flux', prompt: 'a boulder' }),
      ).resolves.toEqual([{ text: 'rewritten', parameters: {} }])
      expect(suggest).toHaveBeenCalledWith({ modelId: 'model_flux', prompt: 'a boulder' })
    })

    it('refuses a request without a model', async () => {
      const suggest = vi.fn(() => Promise.reject(new Error('unused')))
      register({
        prompts: assistant({ suggest }),
      })

      await expect(
        invoke(CHANNELS.providerSuggestPrompts, { prompt: 'a boulder' }),
      ).rejects.toThrow()
      expect(suggest).not.toHaveBeenCalled()
    })

    // The channel answers with a handful of sentences; it is not a way to push a megabyte
    // through the boundary.
    it('refuses a draft longer than the boundary accepts', async () => {
      const suggest = vi.fn(() => Promise.reject(new Error('unused')))
      register({
        prompts: assistant({ suggest }),
      })

      await expect(
        invoke(CHANNELS.providerSuggestPrompts, {
          modelId: 'model_flux',
          prompt: 'x'.repeat(PROMPT_INPUT_MAX + 1),
        }),
      ).rejects.toThrow()
      expect(suggest).not.toHaveBeenCalled()
    })

    it('refuses to ask for more variants than the API accepts', async () => {
      const suggest = vi.fn(() => Promise.reject(new Error('unused')))
      register({
        prompts: assistant({ suggest }),
      })

      await expect(
        invoke(CHANNELS.providerSuggestPrompts, {
          modelId: 'model_flux',
          numResults: PROMPT_SUGGESTIONS_MAX + 1,
        }),
      ).rejects.toThrow()
      expect(suggest).not.toHaveBeenCalled()
    })

    it('reduces a refused suggestion to a code like every other call', async () => {
      const failing = APIError.generate(429, undefined, LEAKY, new Headers())
      register({
        prompts: assistant({ suggest: () => Promise.reject(failing) }),
      })

      const refused = invoke(CHANNELS.providerSuggestPrompts, { modelId: 'model_flux' })

      await expect(refused).rejects.toThrow('rate-limited')
    })
  })

  describe('translating a draft', () => {
    it('passes a valid draft through', async () => {
      const translate = vi.fn(() =>
        Promise.resolve({ text: 'a mossy boulder', detectedLanguage: 'french' }),
      )
      register({
        prompts: assistant({ translate }),
      })

      await expect(invoke(CHANNELS.providerTranslatePrompt, 'un rocher moussu')).resolves.toEqual({
        text: 'a mossy boulder',
        detectedLanguage: 'french',
      })
      expect(translate).toHaveBeenCalledWith('un rocher moussu')
    })

    it('refuses blank text, which has nothing to translate', async () => {
      const translate = vi.fn(() => Promise.reject(new Error('unused')))
      register({
        prompts: assistant({ translate }),
      })

      await expect(invoke(CHANNELS.providerTranslatePrompt, '   ')).rejects.toThrow()
      expect(translate).not.toHaveBeenCalled()
    })
  })

  describe('describing a style', () => {
    it('passes the references through', async () => {
      const describeStyle = vi.fn(() =>
        Promise.resolve({ description: 'muted greens', synthesis: 'two pictures' }),
      )
      register({
        prompts: assistant({ describeStyle }),
      })

      await expect(
        invoke(CHANNELS.providerDescribeStyle, ['asset_one', 'asset_two']),
      ).resolves.toEqual({ description: 'muted greens', synthesis: 'two pictures' })
      expect(describeStyle).toHaveBeenCalledWith(['asset_one', 'asset_two'])
    })

    it('refuses an empty list, which shows nothing to read', async () => {
      const describeStyle = vi.fn(() => Promise.reject(new Error('unused')))
      register({
        prompts: assistant({ describeStyle }),
      })

      await expect(invoke(CHANNELS.providerDescribeStyle, [])).rejects.toThrow()
      expect(describeStyle).not.toHaveBeenCalled()
    })

    it('refuses more references than the API accepts', async () => {
      const describeStyle = vi.fn(() => Promise.reject(new Error('unused')))
      register({
        prompts: assistant({ describeStyle }),
      })

      const tooMany = Array.from({ length: PROMPT_IMAGES_MAX + 1 }, (_unused, at) => `asset_${at}`)

      await expect(invoke(CHANNELS.providerDescribeStyle, tooMany)).rejects.toThrow()
      expect(describeStyle).not.toHaveBeenCalled()
    })
  })

  describe('usage', () => {
    const EMPTY_PAGE = { events: [], cursors: {}, more: false }

    it('passes a period the API accepts straight through', async () => {
      const report = vi.fn(() => Promise.reject(new Error('unused')))
      register({
        usage: reader({ report }),
      })

      await expect(invoke(CHANNELS.providerUsageReport, 31)).rejects.toThrow()
      expect(report).toHaveBeenCalledWith(31)
    })

    // 120 days is the API's ceiling; anything else is a caller inventing a window.
    it('refuses a period the API does not offer', async () => {
      const report = vi.fn(() => Promise.reject(new Error('unused')))
      register({
        usage: reader({ report }),
      })

      await expect(invoke(CHANNELS.providerUsageReport, 45)).rejects.toThrow()
      expect(report).not.toHaveBeenCalled()
    })

    it('pages the log from the cursors it is given and refuses a nonsensical one', async () => {
      const events = vi.fn(() => Promise.resolve(EMPTY_PAGE))
      register({
        usage: reader({ events }),
      })

      const cursors = { 'acc-1': 100 }
      await expect(invoke(CHANNELS.providerUsageEvents, 7, cursors)).resolves.toEqual(EMPTY_PAGE)
      expect(events).toHaveBeenCalledWith(7, cursors)

      await expect(invoke(CHANNELS.providerUsageEvents, 7, { 'acc-1': -1 })).rejects.toThrow()
      await expect(invoke(CHANNELS.providerUsageEvents, 7, 100)).rejects.toThrow()
    })

    it('reduces a refused usage call to a code like every other channel', async () => {
      const failing = APIError.generate(429, undefined, LEAKY, new Headers())
      register({
        usage: reader({ report: () => Promise.reject(failing) }),
      })

      const refused = invoke(CHANNELS.providerUsageReport, 31)

      await expect(refused).rejects.toThrow('rate-limited')
      await expect(refused).rejects.not.toThrow(LEAKY)
    })
  })

  describe('what a generation would cost', () => {
    it('hands the estimate back, validating what the renderer asked with', async () => {
      const estimate = vi.fn(() => Promise.resolve({ creativeUnits: 12 }))
      register({
        estimateCost: estimate,
      })

      const target = { id: 'model_flux' }
      await expect(
        invoke(CHANNELS.providerEstimateCost, target, { prompt: 'a rock' }),
      ).resolves.toEqual({ creativeUnits: 12 })
      expect(estimate).toHaveBeenCalledWith(target, { prompt: 'a rock' })
    })

    /**
     * A dry run VALIDATES the body it is handed, so a figure quoted on a shorter prompt than the
     * one that will be sent is a figure for a call nobody is going to make. Both channels go
     * through the same `promptContext`, which is the whole reason it sits in this file.
     */
    it('prices the body the generation would send, context included', async () => {
      const estimate = vi.fn(() => Promise.resolve({ creativeUnits: 12 }))
      const lengthened: PromptContext = body =>
        Promise.resolve({
          body: { ...body, prompt: `${String(body.prompt)}\n\nWorld: A forest` },
          authored: {
            written: String(body.prompt),
            sent: `${String(body.prompt)}\n\nWorld: A forest`,
          },
        })
      const submit = vi.fn((): Job => ({
        id: 'job_1',
        targetId: 'model_flux',
        label: 'Flux',
        status: 'queued',
        progress: 0,
        createdAt: '2026-08-24T10:00:00.000Z',
        assetIds: [],
      }))
      register({ estimateCost: estimate, promptContext: lengthened, jobs: { ...jobs, submit } })

      const target = { id: 'model_flux' }
      await invoke(CHANNELS.providerEstimateCost, target, { prompt: 'a rock' })
      await invoke(CHANNELS.providerGenerate, 'model_flux', { prompt: 'a rock' })

      expect(estimate).toHaveBeenCalledWith(target, { prompt: 'a rock\n\nWorld: A forest' })
      expect(submit).toHaveBeenCalledWith(
        target,
        expect.any(String),
        { prompt: 'a rock\n\nWorld: A forest' },
        { written: 'a rock', sent: 'a rock\n\nWorld: A forest' },
      )
    })

    it('refuses a malformed request before it reaches the API', async () => {
      const estimate = vi.fn(() => Promise.resolve(null))
      register({
        estimateCost: estimate,
      })

      await expect(invoke(CHANNELS.providerEstimateCost, { id: '  ' }, {})).rejects.toThrow()
      await expect(
        invoke(CHANNELS.providerEstimateCost, { id: 'model_flux' }, 'not a body'),
      ).rejects.toThrow()
      expect(estimate).not.toHaveBeenCalled()
    })
  })
})
