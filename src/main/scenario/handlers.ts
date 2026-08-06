import { CHANNELS } from '@shared/ipc'
import { handle } from '@main/ipc/handle'
import { log } from '@main/log'
import { describeFailure, failureOf } from './client'
import type { JobManager } from './job-manager'
import type { ModelRegistry } from './model-registry'
import {
  parseGenerationBody,
  parseJobId,
  parseModelId,
  parseModelIds,
  parseModelQuery,
} from './validation'

export type ScenarioHandlerDeps = {
  models: ModelRegistry
  jobs: JobManager
}

/**
 * A rejection crossing the boundary carries its message to the renderer. An SDK message
 * embeds the request that produced it, so every failure leaves as a code — the same reduction
 * the job manager and the authentication probe already apply.
 *
 * The cause stays attached for the main process alone: Electron serializes `message`, `name`
 * and `stack` of a rejected handler, never `cause`.
 */
async function reduced<T>(action: () => Promise<T>): Promise<T> {
  try {
    return await action()
  } catch (error) {
    // Logged where the credentials already live: reduced to a code, the renderer cannot say
    // which call the API refused, and neither could anyone reading a bug report.
    log.error('scenario', describeFailure(error))
    throw new Error(failureOf(error), { cause: error })
  }
}

export function registerScenarioHandlers({ models, jobs }: ScenarioHandlerDeps): void {
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

  handle(CHANNELS.scenarioCancelJob, (_event, jobId) => jobs.cancel(parseJobId(jobId)))

  handle(CHANNELS.scenarioListJobs, () => jobs.list())
}
