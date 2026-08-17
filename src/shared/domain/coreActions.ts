import { action, type AssistantAction } from './assistantAction'
import { COMMAND_REGISTRY } from './command'
import { MODEL_FAMILIES } from './model'
import { WORKSPACE_IDS } from './workspace'

/**
 * What a spoken request needs, and the only family reaching `both` doors in full.
 *
 * These eleven are the vocabulary of "open a 3D file", "find me a stone texture" — short, few,
 * and worth the room they take in the assistant's prompt. Every other family is driven by a
 * program that read `tools/list`, and reaches `mcp` alone.
 */
export const CORE_ACTIONS: readonly AssistantAction[] = [
  action({
    name: 'command.run',
    titleKey: 'assistant.actions.commandRun.title',
    descriptionKey: 'assistant.actions.commandRun.description',
    // The floor, not the answer: what this call really engages comes from `commitmentOfCommand`.
    commitment: 'none',
    reach: 'both',
    fields: [
      {
        key: 'command',
        kind: 'choice',
        labelKey: 'assistant.fields.command',
        required: true,
        options: COMMAND_REGISTRY.map(descriptor => descriptor.id),
      },
    ],
  }),
  action({
    name: 'workspace.open',
    titleKey: 'assistant.actions.workspaceOpen.title',
    descriptionKey: 'assistant.actions.workspaceOpen.description',
    commitment: 'none',
    reach: 'both',
    fields: [
      {
        key: 'workspace',
        kind: 'choice',
        labelKey: 'assistant.fields.workspace',
        required: true,
        options: WORKSPACE_IDS,
      },
      {
        key: 'createDocument',
        kind: 'boolean',
        labelKey: 'assistant.fields.createDocument',
        required: false,
      },
    ],
  }),
  action({
    name: 'models.search',
    titleKey: 'assistant.actions.modelsSearch.title',
    descriptionKey: 'assistant.actions.modelsSearch.description',
    commitment: 'none',
    reach: 'both',
    fields: [
      { key: 'query', kind: 'text', labelKey: 'assistant.fields.query', required: true },
      {
        key: 'family',
        kind: 'choice',
        labelKey: 'assistant.fields.family',
        required: false,
        options: MODEL_FAMILIES,
      },
    ],
  }),
  action({
    name: 'models.select',
    titleKey: 'assistant.actions.modelsSelect.title',
    descriptionKey: 'assistant.actions.modelsSelect.description',
    commitment: 'none',
    reach: 'both',
    fields: [
      {
        key: 'family',
        kind: 'choice',
        labelKey: 'assistant.fields.family',
        required: true,
        options: MODEL_FAMILIES,
      },
      { key: 'modelId', kind: 'text', labelKey: 'assistant.fields.modelId', required: true },
    ],
  }),
  action({
    name: 'generator.prepare',
    titleKey: 'assistant.actions.generatorPrepare.title',
    descriptionKey: 'assistant.actions.generatorPrepare.description',
    commitment: 'none',
    reach: 'both',
    fields: [
      {
        key: 'family',
        kind: 'choice',
        labelKey: 'assistant.fields.family',
        required: true,
        options: MODEL_FAMILIES,
      },
      { key: 'modelId', kind: 'text', labelKey: 'assistant.fields.modelId', required: true },
      // `raw`, because the shape is the target model's own and is only known once
      // `GET /models/{id}` has answered — which `model.schema` is there to ask.
      { key: 'parameters', kind: 'raw', labelKey: 'assistant.fields.parameters', required: true },
    ],
  }),
  action({
    name: 'generator.submit',
    titleKey: 'assistant.actions.generatorSubmit.title',
    descriptionKey: 'assistant.actions.generatorSubmit.description',
    commitment: 'credits',
    reach: 'both',
    fields: [],
  }),
  action({
    name: 'jobs.list',
    titleKey: 'assistant.actions.jobsList.title',
    descriptionKey: 'assistant.actions.jobsList.description',
    commitment: 'none',
    reach: 'both',
    fields: [],
  }),
  /**
   * The three the prompt field used to carry as buttons.
   *
   * All `none`, and measured rather than assumed: the three channels behind them answer in one
   * round trip, spend nothing, and produce no job.
   */
  action({
    name: 'prompt.suggest',
    titleKey: 'assistant.actions.promptSuggest.title',
    descriptionKey: 'assistant.actions.promptSuggest.description',
    commitment: 'none',
    reach: 'both',
    fields: [
      { key: 'draft', kind: 'longText', labelKey: 'assistant.fields.draft', required: true },
    ],
  }),
  action({
    name: 'prompt.translate',
    titleKey: 'assistant.actions.promptTranslate.title',
    descriptionKey: 'assistant.actions.promptTranslate.description',
    commitment: 'none',
    reach: 'both',
    fields: [{ key: 'text', kind: 'longText', labelKey: 'assistant.fields.text', required: true }],
  }),
  action({
    // No input: what it reads is the pictures already on the form, which is the only place
    // references exist. Asking the model to name them would have it invent asset ids.
    name: 'prompt.describeStyle',
    titleKey: 'assistant.actions.promptDescribeStyle.title',
    descriptionKey: 'assistant.actions.promptDescribeStyle.description',
    commitment: 'none',
    reach: 'both',
    fields: [],
  }),
  /**
   * The one action about the conversation rather than about the studio.
   *
   * The model is told to call this when what it did is now the thing to look at, and to leave it
   * alone when the answer is the words themselves. Last on purpose: it is the last thing a plan
   * does, and the model reads this list in order.
   */
  action({
    name: 'chat.close',
    titleKey: 'assistant.actions.chatClose.title',
    descriptionKey: 'assistant.actions.chatClose.description',
    commitment: 'none',
    reach: 'both',
    fields: [],
  }),
]
