import { action, type AssistantAction } from './assistantAction'
import { USAGE_PERIODS } from './usage'

/**
 * A generation followed from the outside, from what a model accepts to what came out of it.
 *
 * `jobs.list` said `id`, `label`, `status` and `progress` and stopped there, which made a client
 * able to START a generation and unable to learn what it produced — the one thing it was
 * generating for. The four here close that: the schema before, the estimate before, the wait,
 * and the asset ids after.
 */
export const JOB_ACTIONS: readonly AssistantAction[] = [
  action({
    /**
     * The shape `generator.prepare` fills, whose `parameters` field is `raw` precisely because
     * only `GET /models/{id}` knows it. Without this a client guesses at a model's own inputs, or
     * goes and asks Scenario's own MCP — which is not this studio, and would not see what the
     * form on screen already holds.
     */
    name: 'model.schema',
    titleKey: 'assistant.actions.modelSchema.title',
    descriptionKey: 'assistant.actions.modelSchema.description',
    commitment: 'none',
    repeatable: true,
    reach: 'mcp',
    fields: [
      { key: 'modelId', kind: 'text', labelKey: 'assistant.fields.modelId', required: true },
    ],
  }),
  action({
    name: 'cost.estimate',
    titleKey: 'assistant.actions.costEstimate.title',
    descriptionKey: 'assistant.actions.costEstimate.description',
    commitment: 'none',
    repeatable: true,
    reach: 'mcp',
    fields: [
      { key: 'modelId', kind: 'text', labelKey: 'assistant.fields.modelId', required: true },
      { key: 'parameters', kind: 'raw', labelKey: 'assistant.fields.parameters', required: true },
    ],
  }),
  action({
    name: 'job.get',
    titleKey: 'assistant.actions.jobGet.title',
    descriptionKey: 'assistant.actions.jobGet.description',
    commitment: 'none',
    repeatable: true,
    reach: 'mcp',
    fields: [{ key: 'jobId', kind: 'text', labelKey: 'assistant.fields.jobId', required: true }],
  }),
  action({
    /**
     * Bounded under the two minutes a remote call is given: a wait that outlived its own answer
     * would hand the client a timeout instead of the job it was watching.
     */
    name: 'job.wait',
    titleKey: 'assistant.actions.jobWait.title',
    descriptionKey: 'assistant.actions.jobWait.description',
    commitment: 'none',
    repeatable: true,
    reach: 'mcp',
    fields: [
      { key: 'jobId', kind: 'text', labelKey: 'assistant.fields.jobId', required: true },
      {
        key: 'timeoutMs',
        kind: 'integer',
        labelKey: 'assistant.fields.timeoutMs',
        required: false,
        min: 1_000,
        max: 110_000,
      },
    ],
  }),
  action({
    name: 'job.cancel',
    titleKey: 'assistant.actions.jobCancel.title',
    descriptionKey: 'assistant.actions.jobCancel.description',
    commitment: 'none',
    repeatable: true,
    reach: 'mcp',
    fields: [{ key: 'jobId', kind: 'text', labelKey: 'assistant.fields.jobId', required: true }],
  }),
  action({
    /**
     * The studio's OWN long tasks — an ffmpeg render, an ingest, an index — which are not jobs:
     * a job runs on Scenario's side and is cancelled there. Both are followed by a task id.
     */
    name: 'task.cancel',
    titleKey: 'assistant.actions.taskCancel.title',
    descriptionKey: 'assistant.actions.taskCancel.description',
    commitment: 'none',
    repeatable: true,
    reach: 'mcp',
    fields: [{ key: 'taskId', kind: 'text', labelKey: 'assistant.fields.taskId', required: true }],
  }),
  action({
    name: 'usage.report',
    titleKey: 'assistant.actions.usageReport.title',
    descriptionKey: 'assistant.actions.usageReport.description',
    commitment: 'none',
    repeatable: true,
    reach: 'mcp',
    fields: [
      // A closed set rather than a bounded number: the API takes three windows and nothing
      // between them, and `validatesInput` only holds a closed set on a field that is text.
      {
        key: 'days',
        kind: 'choice',
        labelKey: 'assistant.fields.days',
        required: false,
        options: USAGE_PERIODS.map(String),
      },
    ],
  }),
]
