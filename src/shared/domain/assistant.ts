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

/**
 * The catalogue model the assistant thinks with. One model, whose own `model` parameter picks
 * which language model actually answers.
 *
 * It is an ordinary model of the catalogue, which is the whole reason the assistant needs no
 * second account and no second key: it goes through `ModelRegistry`, the `JobManager`, the rate
 * limiter and the cost meter that are already there.
 */
export const ASSISTANT_MODEL_ID = 'model_scenario-llm'

/**
 * Which language model answers, and what it costs.
 *
 * Measured with `dryRun` on 2026-08-15, for one short instruction: Haiku 4.5 at 0.75 creative
 * units, Gemini 3.5 Flash at 1, Opus 4.8 at 2.75. Ten blocks of history take Haiku from 0.75 to
 * 1 — so a five-turn conversation costs about what one picture does, which is why the modal
 * shows the running total rather than leaving it to be discovered on the invoice.
 *
 * The full list the API accepts is wider; these are the four worth offering. Haiku is the
 * default: routing a sentence to an action is not the work that needs the best model.
 */
export type AssistantModel =
  'claude-haiku-4-5' | 'claude-sonnet-4-6' | 'claude-opus-4-8' | 'gemini-3.5-flash'

export const ASSISTANT_MODELS: readonly AssistantModel[] = [
  'claude-haiku-4-5',
  'claude-sonnet-4-6',
  'claude-opus-4-8',
  'gemini-3.5-flash',
]

export const DEFAULT_ASSISTANT_MODEL: AssistantModel = 'claude-haiku-4-5'

/** What the API refuses beyond, measured from the model's own schema. */
export const INSTRUCTION_MAX = 10_000
export const HISTORY_MAX = 10

export type ActionName =
  | 'command.run'
  | 'workspace.open'
  | 'models.search'
  | 'models.select'
  | 'generator.prepare'
  | 'generator.submit'
  | 'jobs.list'
  | 'prompt.suggest'
  | 'prompt.translate'
  | 'prompt.describeStyle'

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
export function commitmentOfCommand(id: string): ActionCommitment {
  // A `string` for the same reason `commandDescriptor` takes one: what asks holds a name, not a
  // narrowed id. An id nothing declares rates as `none`, which is the level of a call that will
  // be refused before it runs anyway.
  return UPLOADING_COMMANDS.some(uploading => uploading === id) ? 'asset' : 'none'
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
  /**
   * The three the prompt field used to carry as buttons.
   *
   * All `none`, and measured rather than assumed: the three channels behind them answer in one
   * round trip, spend nothing, and produce no job — which is why they were free to press and are
   * free to ask for.
   */
  action({
    name: 'prompt.suggest',
    titleKey: 'assistant.actions.promptSuggest.title',
    descriptionKey: 'assistant.actions.promptSuggest.description',
    commitment: 'none',
    fields: [
      { key: 'draft', kind: 'longText', labelKey: 'assistant.fields.draft', required: true },
    ],
  }),
  action({
    name: 'prompt.translate',
    titleKey: 'assistant.actions.promptTranslate.title',
    descriptionKey: 'assistant.actions.promptTranslate.description',
    commitment: 'none',
    fields: [{ key: 'text', kind: 'longText', labelKey: 'assistant.fields.text', required: true }],
  }),
  action({
    // No input: what it reads is the pictures already on the form, which is the only place
    // references exist. Asking the model to name them would have it invent asset ids.
    name: 'prompt.describeStyle',
    titleKey: 'assistant.actions.promptDescribeStyle.title',
    descriptionKey: 'assistant.actions.promptDescribeStyle.description',
    commitment: 'none',
    fields: [],
  }),
]

export const ACTION_COMMITMENTS: readonly ActionCommitment[] = ['none', 'asset', 'credits']

/** One thing the assistant decided to do. Checked against the registry before it is run. */
export type AssistantCall = { action: ActionName; input: Record<string, unknown> }

/** What is asked of whatever does the thinking. */
export type AssistantThought = {
  utterance: string
  /**
   * The turns before this one, oldest first, already rendered as lines. Rendered rather than
   * structured because that is what a model reads, and because the implementation the studio
   * ships can only carry ten blocks of text.
   */
  history: readonly string[]
}

export type AssistantAnswer = {
  /** What to say to the person. Empty when the actions speak for themselves. */
  say: string
  calls: readonly AssistantCall[]
  /**
   * What the turn cost, in creative units.
   *
   * On the answer rather than reported separately: the modal shows a running total, and a figure
   * that arrived by another route would drift from it the first time a call failed halfway.
   */
  cost: number
}

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
  /** Nobody was there to be asked — see `runConfirmedAction`. Never a silent yes. */
  | 'noConfirmer'
  | 'declined'
  /** No window at the front to act at all. Only an action arriving from outside can meet this. */
  | 'noWindow'
  /** The question stood on screen and nobody answered it. Same reason, same one caller. */
  | 'timedOut'
  /** Nothing to read a style from: the form carries no reference picture. */
  | 'noReference'

export const ACTION_REFUSALS: readonly ActionRefusal[] = [
  'unknownCommand',
  'globalCommand',
  'wrongSurface',
  'generatorClosed',
  'nothingPrepared',
  'notSubmitted',
  'badInput',
  'noBridge',
  'noConfirmer',
  'declined',
  'noWindow',
  'timedOut',
  'noReference',
]

/**
 * What running an action answered.
 *
 * Shared rather than the window's own, since an action asked for from outside is answered back
 * across the boundary: the MCP server hands this to its client. A refusal carries a key rather
 * than a sentence, for the reason the list above gives — it is read in two languages.
 */
export type ActionOutcome = { ok: true; data?: unknown } | { ok: false; refusal: ActionRefusal }

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

/**
 * What one particular call would engage, which for `command.run` is a fact of the command named
 * rather than of the action.
 *
 * Shared because both sides ask: the window asks before it acts, and the MCP server asks before
 * it tells a window to. A second copy of this arithmetic is the one that would drift, and it
 * would drift towards spending something without asking.
 */
export function commitmentOfCall(
  name: ActionName,
  input: Record<string, unknown>,
): ActionCommitment {
  if (name === 'generator.submit') return 'credits'
  if (name !== 'command.run') return assistantAction(name)?.commitment ?? 'none'

  const id = input.command
  return typeof id === 'string' ? commitmentOfCommand(id) : 'none'
}
