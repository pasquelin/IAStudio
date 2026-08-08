import type Scenario from '@scenario-labs/sdk'
import type { JobRunner } from './job-manager'
import { asUrgent } from './rate-limiter'

/**
 * Binds the job manager's narrow runner to the real SDK. The client is captured, not resolved
 * per call: a job is submitted, polled and cancelled on one account — see `JobAccount`.
 */
export function runnerOf(client: Scenario): JobRunner {
  return {
    // The cost is on the submission response, beside the job and not inside it — and it is never
    // said again, the polled job does not carry it. Read here or lost.
    submit: async (modelId, body) => {
      const { job, creativeUnitsCost } = await client.generate.runModel(modelId, { body })
      return creativeUnitsCost === undefined ? job : { ...job, cost: creativeUnitsCost }
    },

    poll: async jobId => (await client.jobs.retrieve(jobId)).job,

    // Ahead of the queue: this is the one call whose purpose is to stop spending, and behind a
    // saturated window it would be held for as long as the generation it is meant to stop.
    cancel: async jobId => {
      await asUrgent(() => client.jobs.triggerAction(jobId, { action: 'cancel' }))
    },
  }
}
