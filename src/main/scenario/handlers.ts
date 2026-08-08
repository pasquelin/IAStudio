import { CHANNELS } from '@shared/ipc'
import { handle } from '@main/ipc/handle'
import { reducedBy } from './client'
import type { JobManager } from './job-manager'
import type { ModelRegistry } from './model-registry'
import type { AssetUploader } from './uploader'
import {
  parseAssetName,
  parseBase64,
  parseGenerationBody,
  parseJobId,
  parseModelId,
  parseModelIds,
  parseModelQuery,
} from './validation'

export type ScenarioHandlerDeps = {
  models: ModelRegistry
  jobs: JobManager
  uploads: AssetUploader
}

const reduced = reducedBy('scenario')

export function registerScenarioHandlers({ models, jobs, uploads }: ScenarioHandlerDeps): void {
  handle(CHANNELS.scenarioSearchModels, (_event, query) =>
    reduced(() => models.search(parseModelQuery(query))),
  )

  handle(CHANNELS.scenarioModelPreviews, (_event, assetIds) =>
    reduced(() => models.previews(parseModelIds(assetIds))),
  )

  handle(CHANNELS.scenarioDescribeModel, (_event, modelId) =>
    reduced(() => models.describe(parseModelId(modelId))),
  )

  handle(CHANNELS.scenarioGenerate, async (_event, modelId, body) => {
    const id = parseModelId(modelId)
    const parsedBody = parseGenerationBody(body)

    // `describe` rather than `list`: the generator just used it to render the form, so it is
    // warm, whereas a cold `list` paginates the whole catalogue before the job is even queued.
    // A missing label is a cosmetic problem; refusing to generate over one is not.
    const label = await models
      .describe(id)
      .then(descriptor => descriptor.name)
      .catch(() => id)

    return jobs.submit(id, label, parsedBody)
  })

  handle(CHANNELS.scenarioUploadAsset, (_event, name, image) =>
    reduced(() => uploads.upload(parseAssetName(name), parseBase64(image))),
  )

  handle(CHANNELS.scenarioCancelJob, (_event, jobId) => jobs.cancel(parseJobId(jobId)))

  handle(CHANNELS.scenarioListJobs, () => jobs.list())
}
