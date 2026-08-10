import type { Job, JobTarget } from '@shared/domain/job'
import { CHANNELS } from '@shared/ipc'
import { handle } from '@main/ipc/handle'
import { log } from '@main/log'
import { compileGraph } from './workflow-compile'
import { reducedBy } from './client'
import type { JobManager } from './job-manager'
import type { ModelRegistry } from './model-registry'
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
  workflows: WorkflowRegistry
  jobs: JobManager
  prompts: PromptAssist
  uploads: AssetUploader
  usage: UsageReader
  /** What a run would cost, asked before it is run — of a model or of a workflow. */
  estimateCost: CostEstimator
}

const reduced = reducedBy('scenario')

export function registerScenarioHandlers({
  models,
  workflows,
  jobs,
  prompts,
  uploads,
  usage,
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

  // No account, no network, no key: the compiler is a pure function of the SDK, and it answers
  // while the user is still wiring. It is here because only this side speaks SDK (invariant 2).
  handle(CHANNELS.workflowsCompile, (_event, graph) =>
    Promise.resolve(
      compileGraph(parseGraphState(graph), {
        report: message => log.warn('scenario', `workflow compile: ${message}`),
      }),
    ),
  )

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
