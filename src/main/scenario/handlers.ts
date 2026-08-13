import type { Job, JobTarget } from '@shared/domain/job'
import { CHANNELS } from '@shared/ipc'
import { handle } from '@main/ipc/handle'
import { reducedBy } from './client'
import type { JobManager } from './job-manager'
import type { ModelRegistry } from './model-registry'
import type { PlanReader } from './plan'
import type { PromptAssist } from './prompt-assist'
import type { AssetUploader } from './uploader'
import type { CostEstimator } from './cost'
import type { UsageReader } from './usage'
import {
  parseAssetName,
  parseBase64,
  parseGenerationBody,
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
} from './validation'

export type ScenarioHandlerDeps = {
  models: ModelRegistry
  jobs: JobManager
  prompts: PromptAssist
  uploads: AssetUploader
  usage: UsageReader
  /** The account's plan, so the picker can refuse a model before the API does. */
  plan: PlanReader
  /** What a run would cost, asked before it is run. */
  estimateCost: CostEstimator
}

const reduced = reducedBy('scenario')

export function registerScenarioHandlers({
  models,
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

  // What is priced is a target, exactly as what is submitted is. Where the figure sits in the
  // answer is `cost.ts`'s business, not this one's.
  handle(CHANNELS.scenarioEstimateCost, (_event, target, body) =>
    reduced(() => estimateCost(parseJobTarget(target), parseGenerationBody(body))),
  )

  handle(CHANNELS.scenarioUploadAsset, (_event, name, image) =>
    reduced(() => uploads.upload(parseAssetName(name), parseBase64(image))),
  )

  handle(CHANNELS.scenarioCancelJob, (_event, jobId) => jobs.cancel(parseJobId(jobId)))

  handle(CHANNELS.scenarioListJobs, () => jobs.list())
}
