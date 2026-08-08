import type Scenario from '@scenario-labs/sdk'
import type { JobRunner } from './job-manager'
import { asUrgent } from './rate-limiter'

/**
 * Binds the job manager's narrow runner to the real SDK. The client is captured, not resolved
 * per call: a job is submitted, polled and cancelled on one account — see `JobAccount`.
 */
export function runnerOf(client: Scenario): JobRunner {
  return {
    submit: async (modelId, body) => (await client.generate.runModel(modelId, { body })).job,

    poll: async jobId => (await client.jobs.retrieve(jobId)).job,

    // Ahead of the queue: this is the one call whose purpose is to stop spending, and behind a
    // saturated window it would be held for as long as the generation it is meant to stop.
    cancel: async jobId => {
      await asUrgent(() => client.jobs.triggerAction(jobId, { action: 'cancel' }))
    },
  }
}
