import type Scenario from '@scenario-labs/sdk'
import type { JobRunner } from './job-manager'

/**
 * Binds the job manager's narrow runner to the real SDK. The client is captured, not resolved
 * per call: a job is submitted, polled and cancelled on one account — see `JobAccount`.
 */
export function runnerOf(client: Scenario): JobRunner {
  return {
    submit: async (modelId, body) => (await client.generate.runModel(modelId, { body })).job,

    poll: async jobId => (await client.jobs.retrieve(jobId)).job,

    cancel: async jobId => {
      await client.jobs.triggerAction(jobId, { action: 'cancel' })
    },
  }
}
