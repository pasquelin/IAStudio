import type { WorkflowEditorModel } from '@scenario-labs/sdk'
import type { GraphState } from '@shared/domain/graph'
import type { Job, JobTarget } from '@shared/domain/job'
import { messageOf } from '@shared/guards'
import { CHANNELS } from '@shared/ipc'
import { handle } from '@main/ipc/handle'
import { log } from '@main/log'
import { compileGraph, editorModelOf, modelIdsOf } from './workflow-compile'
import { reducedBy } from './client'
import type { JobManager } from './job-manager'
import type { ModelRegistry } from './model-registry'
import type { PlanReader } from './plan'
import type { PromptAssist } from './prompt-assist'
import type { AssetUploader } from './uploader'
import type { CostEstimator } from './cost'
import type { UsageReader } from './usage'
import type { WorkflowRegistry } from './workflow-registry'
import {
  parseAssetName,
  parseBase64,
  parseGenerationBody,
  parseGraphState,
  parseJobId,
  parseModelId,
  parseModelIds,
  parseModelQuery,
  parsePromptDraft,
  parseReferenceImages,
  parseSuggestPrompts,
  parseUsageCursors,
  parseJobTarget,
  parseUsagePeriod,
  parseWorkflowId,
  parseWorkflowQuery,
} from './validation'

export type ScenarioHandlerDeps = {
  models: ModelRegistry
  /** Bounds what a compile asks the catalogue: a graph read off an App names dozens of models. */
  queue: <T>(task: () => Promise<T>) => Promise<T>
  workflows: WorkflowRegistry
  jobs: JobManager
  prompts: PromptAssist
  uploads: AssetUploader
  usage: UsageReader
  /** The account's plan, so the picker can refuse a model before the API does. */
  plan: PlanReader
  /** What a run would cost, asked before it is run — of a model or of a workflow. */
  estimateCost: CostEstimator
}

const reduced = reducedBy('scenario')

/**
 * The models a graph names, as the converter reads them.
 *
 * Through the queue rather than a bare `Promise.all`: a graph read off a published App names
 * dozens of models, and asking for every schema at once is the unbounded burst the guide names.
 * Warm after the first compile — the registry caches a schema for ten minutes.
 *
 * A model nobody can describe — deleted, or a key that no longer reaches it — is LEFT OUT rather
 * than allowed to fail the compile: the graph still says how many steps it holds, and the wires
 * of that one node are dropped exactly as they were before any of this existed.
 */
async function resolveModels(
  graph: GraphState,
  models: ModelRegistry,
  queue: <T>(task: () => Promise<T>) => Promise<T>,
): Promise<Map<string, WorkflowEditorModel>> {
  const resolved = new Map<string, WorkflowEditorModel>()

  await Promise.all(
    modelIdsOf(graph).map(modelId =>
      queue(() => models.inputsOf(modelId))
        .then(inputs => {
          resolved.set(modelId, editorModelOf(modelId, inputs))
        })
        .catch((error: unknown) => {
          log.warn('scenario', `workflow compile: ${modelId}: ${messageOf(error)}`)
        }),
    ),
  )

  return resolved
}

export function registerScenarioHandlers({
  models,
  queue,
  workflows,
  jobs,
  prompts,
  uploads,
  usage,
  plan,
  estimateCost,
}: ScenarioHandlerDeps): void {
  handle(CHANNELS.scenarioUsageReport, (_event, period) =>
    reduced(() => usage.report(parseUsagePeriod(period))),
  )

  handle(CHANNELS.scenarioUsageEvents, (_event, period, cursors) =>
    reduced(() => usage.events(parseUsagePeriod(period), parseUsageCursors(cursors))),
  )

  handle(CHANNELS.scenarioSearchModels, (_event, query) =>
    reduced(() => models.search(parseModelQuery(query))),
  )

  handle(CHANNELS.scenarioModelPreviews, (_event, assetIds) =>
    reduced(() => models.previews(parseModelIds(assetIds))),
  )

  handle(CHANNELS.scenarioDescribeModel, (_event, modelId) =>
    reduced(() => models.describe(parseModelId(modelId))),
  )

  handle(CHANNELS.scenarioPlan, () => reduced(() => plan.access()))

  handle(CHANNELS.scenarioSuggestPrompts, (_event, request) =>
    reduced(() => prompts.suggest(parseSuggestPrompts(request))),
  )

  handle(CHANNELS.scenarioTranslatePrompt, (_event, draft) =>
    reduced(() => prompts.translate(parsePromptDraft(draft))),
  )

  handle(CHANNELS.scenarioDescribeStyle, (_event, images) =>
    reduced(() => prompts.describeStyle(parseReferenceImages(images))),
  )

  /**
   * Queues a job under the name of what it runs.
   *
   * `describe` rather than `list`: the panel just used it to render the form, so it is warm,
   * whereas a cold listing paginates a whole catalogue before the job is even queued. A missing
   * name is a cosmetic problem; refusing to run over one is not.
   */
  const submitNamed = async (
    target: JobTarget,
    describe: (id: string) => Promise<{ name: string }>,
    body: Record<string, unknown>,
  ): Promise<Job> => {
    const label = await describe(target.id)
      .then(descriptor => descriptor.name)
      .catch(() => target.id)

    return jobs.submit(target, label, body)
  }

  handle(CHANNELS.scenarioGenerate, (_event, modelId, body) =>
    submitNamed(
      { kind: 'model', id: parseModelId(modelId) },
      id => models.describe(id),
      parseGenerationBody(body),
    ),
  )

  handle(CHANNELS.workflowsSearch, (_event, query) =>
    reduced(() => workflows.search(parseWorkflowQuery(query))),
  )

  handle(CHANNELS.workflowsDescribe, (_event, workflowId) =>
    reduced(() => workflows.describe(parseWorkflowId(workflowId))),
  )

  // Here because only this side speaks SDK (invariant 2), and it answers while the user is still
  // wiring — hence the models resolved first: the converter is synchronous and drops every wire
  // whose input it cannot name, so a compile with no models is a compile with no wires.
  handle(CHANNELS.workflowsCompile, async (_event, graph) => {
    const state = parseGraphState(graph)
    const resolved = await resolveModels(state, models, queue)

    return compileGraph(state, {
      report: message => log.warn('scenario', `workflow compile: ${message}`),
      getModel: modelId => resolved.get(modelId),
    })
  })

  handle(CHANNELS.workflowsRun, (_event, workflowId, body) =>
    submitNamed(
      { kind: 'workflow', id: parseWorkflowId(workflowId) },
      id => workflows.describe(id),
      parseGenerationBody(body),
    ),
  )

  // One channel for the two things the studio runs: what is priced is a target, exactly as what
  // is submitted is. Where the figure sits in the answer is `cost.ts`'s business, not this one's.
  handle(CHANNELS.scenarioEstimateCost, (_event, target, body) =>
    reduced(() => estimateCost(parseJobTarget(target), parseGenerationBody(body))),
  )

  handle(CHANNELS.scenarioUploadAsset, (_event, name, image) =>
    reduced(() => uploads.upload(parseAssetName(name), parseBase64(image))),
  )

  handle(CHANNELS.scenarioCancelJob, (_event, jobId) => jobs.cancel(parseJobId(jobId)))

  handle(CHANNELS.scenarioListJobs, () => jobs.list())
}
