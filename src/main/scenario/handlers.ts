import type { WorkflowEditorModel } from '@scenario-labs/sdk'
import type { GraphState } from '@shared/domain/graph'
import type { Job, JobTarget } from '@shared/domain/job'
import { messageOf } from '@shared/guards'
import { CHANNELS } from '@shared/ipc'
import { handle } from '@main/ipc/handle'
import { log } from '@main/log'
import { workflowFileOf } from '@shared/domain/workflow-file'
import { compileGraph, editorModelOf, modelIdsOf } from './workflow-compile'
import { openTransformThread } from './transform-thread'
import { reducedBy } from './client'
import type { JobManager } from './job-manager'
import type { ModelRegistry } from './model-registry'
import type { PlanReader } from './plan'
import type { PromptAssist } from './prompt-assist'
import type { AssetUploader } from './uploader'
import type { CostEstimator } from './cost'
import type { UsageReader } from './usage'
import type { OwnerScope } from './owner-scope'
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
  parseTransformExpression,
  parseTransformVariables,
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
  /**
   * Asks where an exported workflow goes and writes it there, or answers `null` where the picker
   * was closed. Injected rather than reached for: this module speaks SDK, not filesystem.
   */
  saveWorkflow: (name: string, contents: string) => Promise<string | null>
  /**
   * Which project the active key belongs to, for `exportedBy`. It answers `null` until the
   * library has reported once — written as an empty string then, which is what the field means:
   * nobody has said.
   */
  ownerScope: OwnerScope
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
  saveWorkflow,
  ownerScope,
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

  /**
   * Here for the reason the compile above is: the evaluator is the SDK's, and only this side
   * speaks SDK. Off this process all the same — CEL's `matches()` is JavaScript's own `RegExp`,
   * which no signal interrupts, so an evaluation runs on a thread the client can kill.
   *
   * The thread starts on the first expression, never at registration: a session that opens no
   * graph pays nothing for it.
   */
  const transforms = openTransformThread(message =>
    log.warn('scenario', `workflow transform: ${message}`),
  )

  /**
   * The graph as a file the webapp opens. Two of its fields are only knowable here — the clock,
   * and the account the key belongs to — and the renderer has no filesystem besides (invariant 1).
   *
   * **No node count is checked.** A ceiling of 50 is written in the prose and no call has ever
   * measured it: the one App readable from here holds 42 editor nodes, so nothing contradicts it
   * and nothing confirms it either. A local refusal on an unmeasured threshold would turn away
   * graphs Scenario accepts, where the API says the truth.
   */
  handle(CHANNELS.workflowsExport, async (_event, graph, name) => {
    const file = workflowFileOf(parseGraphState(graph), {
      name: parseAssetName(name),
      exportedAt: new Date().toISOString(),
      exportedBy: ownerScope.current() ?? '',
    })

    return (await saveWorkflow(file.name, `${JSON.stringify(file, null, 2)}\n`)) !== null
  })

  handle(CHANNELS.workflowsTransform, (_event, expression, variables) => {
    // Around the parsing as well as the evaluation: a refusal here used to reject the invoke
    // with nothing written anywhere, so a node read "invalid expression" over a bound the user
    // had no way of learning about.
    try {
      return transforms.evaluate(
        parseTransformExpression(expression),
        parseTransformVariables(variables),
      )
    } catch (error) {
      log.warn('scenario', `workflow transform refused: ${messageOf(error)}`)
      return Promise.resolve(null)
    }
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
