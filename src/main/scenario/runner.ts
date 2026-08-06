import type Scenario from '@scenario-labs/sdk'
import type { JobRunner } from './job-manager'

/**
 * Binds the job manager's narrow runner to the real SDK. The client is resolved per call: it
 * is rebuilt whenever the credentials change, and a captured one would keep using the old key.
 */
export function runnerOf(client: () => Scenario): JobRunner {
  return {
    submit: async (modelId, body) => (await client().generate.runModel(modelId, { body })).job,

    poll: async jobId => (await client().jobs.retrieve(jobId)).job,

    cancel: async jobId => {
      await client().jobs.triggerAction(jobId, { action: 'cancel' })
    },
  }
}
