import { COMMAND_REGISTRY, type CommandId } from './command'
import { MODEL_FAMILIES, type FieldKind } from './model'
import { WORKSPACE_IDS } from './workspace'

/**
 * What the assistant is allowed to do on the user's behalf, and how each thing is described to
 * the model that chooses it — see spec § 9.
 *
 * One table, read by two surfaces that must never disagree: the assistant inside the window,
 * which lists it to the model as the vocabulary it may use, and the MCP server, which publishes
 * it as tools to whatever client connects. An action added here appears on both sides.
 */

export type ActionName =
  | 'command.run'
  | 'workspace.open'
  | 'models.search'
  | 'models.select'
  | 'generator.prepare'
  | 'generator.submit'
  | 'jobs.list'

/**
 * What running an action leaves behind, and therefore whether it may run without being asked.
 *
 * Three values because three things really happen, measured rather than assumed:
 *
 * - `none` — undoable, and nothing outlives the window. Opening a tab, picking a model, filling
 *   a form. Asking about these would make the assistant tiresome for no gain.
 * - `asset` — uploads a picture, which becomes a permanent asset in the user's library.
 *   `prepareEdit` says so itself before it sends anything. Costs no credits, and is still worth
 *   a yes: nothing in the studio removes it afterwards.
 * - `credits` — spends real money. Confirmed, and the estimate is stated first.
 *
 * The distinction between the last two matters at the moment of asking: an upload has no figure
 * to quote, and inventing one would be worse than admitting there is none.
 */
export type ActionCommitment = 'none' | 'asset' | 'credits'

/**
 * One input of an action.
 *
 * Deliberately NOT `FieldDescriptor`: that one carries `label`, a sentence the Scenario API
 * writes and the form shows as-is. A static registry cannot hold a sentence — every word bound
 * for the screen lives in a bundle — so this carries `labelKey` instead. The `kind` union is
 * shared with it, because the two describe the same thing and a second vocabulary for
 * "this is a number between 1 and 5" would be one to keep in step forever.
 */
export type ActionField = {
  key: string
  kind: FieldKind
  labelKey: string
  required: boolean
  /**
   * The values this field accepts, when it accepts a closed set. Raw identifiers rather than
   * translated labels: these are read by a model and by an MCP client, never shown as-is.
   */
  options?: readonly string[]
  min?: number
  max?: number
}

export type AssistantAction = {
  name: ActionName
  titleKey: string
  /** Never optional: an action the model cannot be told the purpose of is one it will misuse. */
  descriptionKey: string
  commitment: ActionCommitment
  fields: readonly ActionField[]
}

function action(descriptor: AssistantAction): AssistantAction {
  return descriptor
}

/**
 * The commands that upload a picture before they prepare anything.
 *
 * Not the same list as "the AI edits": `prepareEdit` prepares and stops — the form is never
 * short-circuited and nothing is billed until the user submits (invariant 5). What it does do,
 * every time, is flatten the canvas and upload it, and the code says why in as many words: "an
 * upload is a permanent asset in the user's library". That is what earns the yes here, not a
 * cost that does not exist yet.
 */
const UPLOADING_COMMANDS: readonly CommandId[] = [
  'canvas.regenerate',
  'canvas.cutout',
  'canvas.enlarge',
  'canvas.vectorize',
  'canvas.extend',
]

/**
 * What `command.run` engages, which depends entirely on the command it is pointed at.
 *
 * The one place in the registry where a level is derived rather than declared, and therefore the
 * one guarded command by command: a miss here is a permanent asset created without a yes, and
 * nothing downstream would catch it.
 */
export function commitmentOfCommand(id: CommandId): ActionCommitment {
  return UPLOADING_COMMANDS.includes(id) ? 'asset' : 'none'
}

export const ACTION_REGISTRY: readonly AssistantAction[] = [
  action({
    name: 'command.run',
    titleKey: 'assistant.actions.commandRun.title',
    descriptionKey: 'assistant.actions.commandRun.description',
    // The floor, not the answer: what this call really engages comes from `commitmentOfCommand`.
    commitment: 'none',
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
      // `GET /models/{id}` has answered. Narrowed against that schema before it is written.
      { key: 'parameters', kind: 'raw', labelKey: 'assistant.fields.parameters', required: true },
    ],
  }),
  action({
    name: 'generator.submit',
    titleKey: 'assistant.actions.generatorSubmit.title',
    descriptionKey: 'assistant.actions.generatorSubmit.description',
    commitment: 'credits',
    fields: [],
  }),
  action({
    name: 'jobs.list',
    titleKey: 'assistant.actions.jobsList.title',
    descriptionKey: 'assistant.actions.jobsList.description',
    commitment: 'none',
    fields: [],
  }),
]

export const ACTION_COMMITMENTS: readonly ActionCommitment[] = ['none', 'asset', 'credits']

/**
 * Why an action did not run.
 *
 * Shared rather than private to the executor, because the sentence is read twice and in two
 * languages: the person watching the modal reads their own, and the model deciding what to try
 * next reads English. Both renderings come from the bundles, so the list has to be visible from
 * the main process, which does the second one.
 */
export type ActionRefusal =
  | 'unknownCommand'
  | 'globalCommand'
  | 'wrongSurface'
  | 'generatorClosed'
  | 'nothingPrepared'
  | 'notSubmitted'
  | 'badInput'
  | 'noBridge'

export const ACTION_REFUSALS: readonly ActionRefusal[] = [
  'unknownCommand',
  'globalCommand',
  'wrongSurface',
  'generatorClosed',
  'nothingPrepared',
  'notSubmitted',
  'badInput',
  'noBridge',
]

export function refusalKey(refusal: ActionRefusal): string {
  return `assistant.refusals.${refusal}`
}

export function assistantAction(name: string): AssistantAction | null {
  return ACTION_REGISTRY.find(descriptor => descriptor.name === name) ?? null
}

/** Whether running this needs a yes first. `asset` and `credits` do; only `credits` quotes a figure. */
export function needsConfirmation(commitment: ActionCommitment): boolean {
  return commitment !== 'none'
}
