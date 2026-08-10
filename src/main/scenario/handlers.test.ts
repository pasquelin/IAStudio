import { APIError } from '@scenario-labs/sdk'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { CHANNELS } from '@shared/ipc'
import {
  PROMPT_IMAGES_MAX,
  PROMPT_INPUT_MAX,
  PROMPT_SUGGESTIONS_MAX,
} from '@shared/domain/prompt-assist'
import { invoke, resetHandlers } from '@main/ipc/test-harness'
import { registerScenarioHandlers, type ScenarioHandlerDeps } from './handlers'
import type { WorkflowRegistry } from './workflow-registry'
import type { AssetUploader } from './uploader'
import type { JobManager } from './job-manager'
import type { ModelRegistry } from './model-registry'
import type { PromptAssist } from './prompt-assist'
import type { CostEstimator } from './cost'
import type { UsageReader } from './usage'

vi.mock('electron', async () => (await import('@main/ipc/test-harness')).mockElectron())

const LEAKY = 'Authorization: Basic YXBpX2tleTpzM2NyM3Q='

function registry(overrides: Partial<ModelRegistry> = {}): ModelRegistry {
  return {
    search: () => Promise.resolve({ items: [], cursor: null }),
    previews: () => Promise.resolve({}),
    describe: () => Promise.reject(new Error('unused')),
    inputsOf: () => Promise.reject(new Error('unused')),
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

function workflowRegistry(overrides: Partial<WorkflowRegistry> = {}): WorkflowRegistry {
  return {
    search: () => Promise.resolve({ items: [], cursor: null }),
    describe: () => Promise.reject(new Error('unused')),
    create: () => Promise.resolve({ id: 'workflow_1' }),
    update: () => Promise.resolve(),
    ...overrides,
  }
}

/**
 * Two generators on the SAME model, so a compile that asked per node rather than per model would
 * be caught by the call count. Marked as an output, or the compile stops before the converter.
 */
const graphWithTwoGenerators = {
  nodes: [
    {
      id: 'm1',
      type: 'model',
      position: { x: 0, y: 0 },
      data: { modelId: 'model_flux', isOutput: true, form: { prompt: 'a knight' } },
    },
    {
      id: 'm2',
      type: 'model',
      position: { x: 400, y: 0 },
      data: { modelId: 'model_flux', isOutput: true, form: { prompt: 'a castle' } },
    },
  ],
  edges: [],
  inputKeys: [],
}

/** Every dependency stubbed, so a case names only the one it is about. */
function register(overrides: Partial<ScenarioHandlerDeps> = {}): void {
  registerScenarioHandlers({
    models: registry(),
    // Straight through, so a case measures what the handler asks for and not what a queue does.
    queue: task => task(),
    workflows: workflowRegistry(),
    jobs,
    prompts,
    uploads,
    usage,
    plan: { access: () => Promise.resolve(null) },
    estimateCost,
    saveWorkflow: () => Promise.resolve('/tmp/graph.workflow.json'),
    ownerScope: { current: () => 'project_1', observe: () => {} },
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

    await expect(invoke(CHANNELS.scenarioSearchModels)).rejects.toThrow('rate-limited')
    await expect(invoke(CHANNELS.scenarioSearchModels)).rejects.not.toThrow(LEAKY)
  })

  it('rejects a query asking for more than one page of models', async () => {
    const search = vi.fn(() => Promise.resolve({ items: [], cursor: null }))
    register({
      models: registry({ search }),
    })

    await expect(invoke(CHANNELS.scenarioSearchModels, { limit: 10_000 })).rejects.toThrow()
    expect(search).not.toHaveBeenCalled()
  })

  it('reduces a describe failure the same way', async () => {
    const failing = APIError.generate(404, undefined, LEAKY, new Headers())
    register({
      models: registry({ describe: () => Promise.reject(failing) }),
    })

    await expect(invoke(CHANNELS.scenarioDescribeModel, 'model_flux')).rejects.toThrow('not-found')
  })

  it('rejects a malformed model identifier before reaching the registry', async () => {
    const describe = vi.fn(() => Promise.reject(new Error('unused')))
    register({
      models: registry({ describe }),
    })

    await expect(invoke(CHANNELS.scenarioDescribeModel, '   ')).rejects.toThrow()
    expect(describe).not.toHaveBeenCalled()
  })

  describe('prompt suggestions', () => {
    it('passes the request through once it is valid', async () => {
      const suggest = vi.fn(() => Promise.resolve([{ text: 'rewritten', parameters: {} }]))
      register({
        prompts: assistant({ suggest }),
      })

      await expect(
        invoke(CHANNELS.scenarioSuggestPrompts, { modelId: 'model_flux', prompt: 'a boulder' }),
      ).resolves.toEqual([{ text: 'rewritten', parameters: {} }])
      expect(suggest).toHaveBeenCalledWith({ modelId: 'model_flux', prompt: 'a boulder' })
    })

    it('refuses a request without a model', async () => {
      const suggest = vi.fn(() => Promise.reject(new Error('unused')))
      register({
        prompts: assistant({ suggest }),
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
      register({
        prompts: assistant({ suggest }),
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
      register({
        prompts: assistant({ suggest }),
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
      register({
        prompts: assistant({ suggest: () => Promise.reject(failing) }),
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
      register({
        prompts: assistant({ translate }),
      })

      await expect(invoke(CHANNELS.scenarioTranslatePrompt, 'un rocher moussu')).resolves.toEqual({
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

      await expect(invoke(CHANNELS.scenarioTranslatePrompt, '   ')).rejects.toThrow()
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
        invoke(CHANNELS.scenarioDescribeStyle, ['asset_one', 'asset_two']),
      ).resolves.toEqual({ description: 'muted greens', synthesis: 'two pictures' })
      expect(describeStyle).toHaveBeenCalledWith(['asset_one', 'asset_two'])
    })

    it('refuses an empty list, which shows nothing to read', async () => {
      const describeStyle = vi.fn(() => Promise.reject(new Error('unused')))
      register({
        prompts: assistant({ describeStyle }),
      })

      await expect(invoke(CHANNELS.scenarioDescribeStyle, [])).rejects.toThrow()
      expect(describeStyle).not.toHaveBeenCalled()
    })

    it('refuses more references than the API accepts', async () => {
      const describeStyle = vi.fn(() => Promise.reject(new Error('unused')))
      register({
        prompts: assistant({ describeStyle }),
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
      register({
        usage: reader({ report }),
      })

      await expect(invoke(CHANNELS.scenarioUsageReport, 31)).rejects.toThrow()
      expect(report).toHaveBeenCalledWith(31)
    })

    // 120 days is the API's ceiling; anything else is a caller inventing a window.
    it('refuses a period the API does not offer', async () => {
      const report = vi.fn(() => Promise.reject(new Error('unused')))
      register({
        usage: reader({ report }),
      })

      await expect(invoke(CHANNELS.scenarioUsageReport, 45)).rejects.toThrow()
      expect(report).not.toHaveBeenCalled()
    })

    it('pages the log from the cursors it is given and refuses a nonsensical one', async () => {
      const events = vi.fn(() => Promise.resolve(EMPTY_PAGE))
      register({
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
      register({
        usage: reader({ report: () => Promise.reject(failing) }),
      })

      const refused = invoke(CHANNELS.scenarioUsageReport, 31)

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

      const target = { kind: 'model', id: 'model_flux' }
      await expect(
        invoke(CHANNELS.scenarioEstimateCost, target, { prompt: 'a rock' }),
      ).resolves.toEqual({ creativeUnits: 12 })
      expect(estimate).toHaveBeenCalledWith(target, { prompt: 'a rock' })
    })

    it('refuses a malformed request before it reaches the API', async () => {
      const estimate = vi.fn(() => Promise.resolve(null))
      register({
        estimateCost: estimate,
      })

      await expect(
        invoke(CHANNELS.scenarioEstimateCost, { kind: 'model', id: '  ' }, {}),
      ).rejects.toThrow()
      await expect(
        invoke(CHANNELS.scenarioEstimateCost, { kind: 'app', id: 'model_flux' }, {}),
      ).rejects.toThrow()
      await expect(
        invoke(CHANNELS.scenarioEstimateCost, { kind: 'model', id: 'model_flux' }, 'not a body'),
      ).rejects.toThrow()
      expect(estimate).not.toHaveBeenCalled()
    })
  })

  describe('workflows', () => {
    it('lists them, validating what the renderer asked with', async () => {
      const search = vi.fn(() => Promise.resolve({ items: [], cursor: null }))
      register({ workflows: workflowRegistry({ search }) })

      await expect(invoke(CHANNELS.workflowsSearch, { privacy: 'public' })).resolves.toEqual({
        items: [],
        cursor: null,
      })
      await expect(invoke(CHANNELS.workflowsSearch, { limit: 10_000 })).rejects.toThrow()
      expect(search).toHaveBeenCalledOnce()
    })

    /** The label follows the same rule as a generation's: read from the description. */
    it('submits a workflow job named after the App', async () => {
      // The handler answers whatever the manager returns; only the arguments are under test.
      const submit = vi.fn(() => ({ id: 'job_1' }) as never)
      register({
        workflows: workflowRegistry({
          describe: () =>
            Promise.resolve({
              id: 'workflow_1',
              name: 'Background remover',
              status: 'ready',
              privacy: 'public',
              tags: [],
              outputKinds: [],
              fields: [],
            }),
        }),
        jobs: { ...jobs, submit },
      })

      await invoke(CHANNELS.workflowsRun, 'workflow_1', { image: 'asset_1' })

      expect(submit).toHaveBeenCalledWith(
        { kind: 'workflow', id: 'workflow_1' },
        'Background remover',
        {
          image: 'asset_1',
        },
      )
    })

    // A description that will not come is a cosmetic problem; refusing to run over one is not.
    it('runs it under its own id when the description cannot be read', async () => {
      // The handler answers whatever the manager returns; only the arguments are under test.
      const submit = vi.fn(() => ({ id: 'job_1' }) as never)
      register({ jobs: { ...jobs, submit } })

      await invoke(CHANNELS.workflowsRun, 'workflow_1', {})

      expect(submit).toHaveBeenCalledWith({ kind: 'workflow', id: 'workflow_1' }, 'workflow_1', {})
    })

    /**
     * The compile resolves the models of the graph BEFORE the converter runs, because the
     * converter is synchronous and skips every wire whose input it cannot name.
     */
    it('asks the registry for the schema of each model the graph names, once', async () => {
      const inputsOf = vi.fn(() => Promise.resolve([{ name: 'prompt', type: 'string' }]))
      register({ models: registry({ inputsOf }) })

      await invoke(CHANNELS.workflowsCompile, graphWithTwoGenerators)

      expect(inputsOf).toHaveBeenCalledTimes(1)
      expect(inputsOf).toHaveBeenCalledWith('model_flux')
    })

    it('runs those lookups through the bounded queue rather than around it', async () => {
      // Counted by hand rather than by `vi.fn`, which does not keep the generic the queue is.
      let queued = 0
      const queue = <T>(task: () => Promise<T>): Promise<T> => {
        queued++
        return task()
      }
      register({ models: registry({ inputsOf: () => Promise.resolve([]) }), queue })

      await invoke(CHANNELS.workflowsCompile, graphWithTwoGenerators)

      expect(queued).toBe(1)
    })

    /**
     * A model that was deleted, or a key that no longer reaches it: the graph must still say
     * whether it compiles. What is lost is that node's wiring, exactly as before any of this.
     */
    it('still answers when a model cannot be described at all', async () => {
      register({
        models: registry({ inputsOf: () => Promise.reject(new Error('gone')) }),
      })

      await expect(invoke(CHANNELS.workflowsCompile, graphWithTwoGenerators)).resolves.toEqual({
        ok: true,
        steps: 2,
      })
    })

    /** One channel prices both, and the target is what says which endpoint answers. */
    it('prices one through the channel that prices a generation', async () => {
      const estimate = vi.fn(() => Promise.resolve({ creativeUnits: 12 }))
      register({ estimateCost: estimate })

      const target = { kind: 'workflow', id: 'workflow_1' }
      await expect(
        invoke(CHANNELS.scenarioEstimateCost, target, { image: 'asset_1' }),
      ).resolves.toEqual({ creativeUnits: 12 })
      expect(estimate).toHaveBeenCalledWith(target, { image: 'asset_1' })
    })
  })

  describe('exporting a graph to a file', () => {
    const withInput = {
      nodes: [
        {
          id: 'image2',
          type: 'asset',
          position: { x: 0, y: 0 },
          data: { isInput: true, type: 'image', title: 'Hero' },
        },
      ],
      edges: [],
      inputKeys: [],
    }

    it('writes the graph under the name it was given, as a workflow file', async () => {
      const saveWorkflow = vi.fn((_name: string, _contents: string) =>
        Promise.resolve('/tmp/Heroes.workflow.json'),
      )
      register({ saveWorkflow })

      await expect(invoke(CHANNELS.workflowsExport, withInput, 'Heroes')).resolves.toBe(true)

      const [name, contents] = saveWorkflow.mock.calls[0] ?? []
      expect(name).toBe('Heroes')
      expect(JSON.parse(String(contents))).toMatchObject({
        version: '1.0',
        name: 'Heroes',
        editorInfo: { nodes: withInput.nodes, edges: [], inputKeys: [] },
        inputs: [{ name: 'image2', label: 'Hero', type: 'file', kind: 'image' }],
      })
    })

    /** Closing the picker is not a failure — nothing was written, and the screen says nothing. */
    it('answers false where the picker was closed', async () => {
      register({ saveWorkflow: () => Promise.resolve(null) })

      await expect(invoke(CHANNELS.workflowsExport, withInput, 'Heroes')).resolves.toBe(false)
    })

    /** `exportedBy` is the project the active key opens onto, and it is only known here. */
    it('stamps the file with the account the key belongs to', async () => {
      const saveWorkflow = vi.fn((_name: string, _contents: string) =>
        Promise.resolve('/tmp/x.json'),
      )
      register({ saveWorkflow, ownerScope: { current: () => 'project_7', observe: () => {} } })

      await invoke(CHANNELS.workflowsExport, withInput, 'Heroes')

      const [, contents] = saveWorkflow.mock.calls[0] ?? []
      expect(JSON.parse(String(contents)).exportedBy).toBe('project_7')
    })

    /** Before the library has answered once there is no owner, and a blank says exactly that. */
    it('leaves the account blank rather than inventing one', async () => {
      const saveWorkflow = vi.fn((_name: string, _contents: string) =>
        Promise.resolve('/tmp/x.json'),
      )
      register({ saveWorkflow, ownerScope: { current: () => null, observe: () => {} } })

      await invoke(CHANNELS.workflowsExport, withInput, 'Heroes')

      const [, contents] = saveWorkflow.mock.calls[0] ?? []
      expect(JSON.parse(String(contents)).exportedBy).toBe('')
    })

    /**
     * No node count is checked, and that is the decision rather than an omission: the ceiling of
     * 50 in the prose has never been measured, and a local refusal on it would turn away graphs
     * Scenario accepts.
     */
    it('publishes the graph as a workflow, models resolved first', async () => {
      const create = vi.fn((_about: { name: string; description: string }) =>
        Promise.resolve({ id: 'workflow_9' }),
      )
      const update = vi.fn((_id: string, _body: unknown) => Promise.resolve())
      // Without a schema the converter names no wire and drops the whole incoming wiring, so the
      // publication must resolve the models before it compiles — as the compile does.
      const inputsOf = vi.fn(() => Promise.resolve([{ name: 'prompt', type: 'string' }]))
      register({ workflows: workflowRegistry({ create, update }), models: registry({ inputsOf }) })

      await expect(
        invoke(CHANNELS.workflowsPublish, graphWithTwoGenerators, 'Heroes'),
      ).resolves.toEqual({ ok: true, workflowId: 'workflow_9' })

      expect(inputsOf).toHaveBeenCalledWith('model_flux')
      expect(create).toHaveBeenCalledWith({ name: 'Heroes', description: '' })
      expect(update.mock.calls[0]?.[0]).toBe('workflow_9')
    })

    /**
     * The refusal the user can ACT on, and the same one the editor already paints. Answered
     * `empty` until the publication rejoined the compile's own verdict, which is the difference
     * between "mark a node as an output" and a code that says nothing.
     */
    it('refuses to publish a graph nothing reaches, in the compile’s own words', async () => {
      const create = vi.fn(() => Promise.resolve({ id: 'workflow_9' }))
      register({ workflows: workflowRegistry({ create }) })

      await expect(invoke(CHANNELS.workflowsPublish, withInput, 'Heroes')).resolves.toEqual({
        ok: false,
        problem: 'no-output',
      })
      expect(create).not.toHaveBeenCalled()
    })

    it('exports a graph of many nodes rather than refusing it on an unmeasured ceiling', async () => {
      const saveWorkflow = vi.fn((_name: string, _contents: string) =>
        Promise.resolve('/tmp/x.json'),
      )
      const nodes = Array.from({ length: 80 }, (_unused, index) => ({
        id: `text${index}`,
        type: 'text',
        position: { x: index, y: 0 },
        data: {},
      }))
      register({ saveWorkflow })

      await expect(
        invoke(CHANNELS.workflowsExport, { nodes, edges: [], inputKeys: [] }, 'Big'),
      ).resolves.toBe(true)
    })
  })
})
