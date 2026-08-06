import { CHANNELS } from '@shared/ipc'
import { handle } from '@main/ipc/handle'
import type { JobManager } from './job-manager'
import type { ModelRegistry } from './model-registry'
import { parseGenerationBody, parseJobId, parseModelFamily, parseModelId } from './validation'

export type ScenarioHandlerDeps = {
  models: ModelRegistry
  jobs: JobManager
}

export function registerScenarioHandlers({ models, jobs }: ScenarioHandlerDeps): void {
  handle(CHANNELS.scenarioListModels, (_event, family) => models.list(parseModelFamily(family)))

  handle(CHANNELS.scenarioDescribeModel, (_event, modelId) =>
    models.describe(parseModelId(modelId)),
  )

  handle(CHANNELS.scenarioGenerate, async (_event, modelId, body) => {
    const id = parseModelId(modelId)
    const parsedBody = parseGenerationBody(body)

    // A missing label is a cosmetic problem; refusing to generate over one is not.
    const label = await models
      .list()
      .then(summaries => summaries.find(summary => summary.id === id)?.name ?? id)
      .catch(() => id)

    return jobs.submit(id, label, parsedBody)
  })

  handle(CHANNELS.scenarioCancelJob, (_event, jobId) => jobs.cancel(parseJobId(jobId)))

  handle(CHANNELS.scenarioListJobs, () => jobs.list())
}
