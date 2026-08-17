import {
  type ActionCommitment,
  type ActionName,
  type AssistantAction,
  type ActionReach,
} from './assistantAction'
import { ASSET_ACTIONS } from './assetActions'
import { CANVAS_ACTIONS } from './canvasActions'
import { type CommandId } from './command'
import { CORE_ACTIONS } from './coreActions'
import { FILE_ACTIONS } from './fileActions'
import { GIT_ACTIONS } from './gitActions'
import { JOB_ACTIONS } from './jobActions'
import { SCENE_ACTIONS } from './sceneActions'
import { SETTINGS_ACTIONS } from './settingsActions'
import { STATE_ACTIONS } from './stateActions'

/**
 * What the assistant is allowed to do on the user's behalf, and how each thing is described to
 * the model that chooses it — see spec § 9.
 *
 * One table, read by two surfaces that must never disagree: the assistant inside the window,
 * which lists it to the model as the vocabulary it may use, and the MCP server, which publishes
 * it as tools to whatever client connects. What each door sees is decided by `reach`, and by
 * nothing else — see `assistantAction.ts`.
 */

export * from './assistantAction'

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

/**
 * The commands that upload a picture before they prepare anything.
 *
 * Not the same list as "the AI edits": `prepareEdit` prepares and stops — the form is never
 * short-circuited and nothing is billed until the user submits (invariant 5). What it does do,
 * every time, is flatten the canvas and upload it, and the code says why in as many words: "an
 * upload is a permanent asset in the user's library".
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

/**
 * Every action the studio publishes, one family after another.
 *
 * Order matters to one reader only — the assistant's model reads its share in this order — so
 * the spoken vocabulary comes first and the families a program drives follow.
 */
export const ACTION_REGISTRY: readonly AssistantAction[] = [
  ...CORE_ACTIONS,
  ...STATE_ACTIONS,
  ...FILE_ACTIONS,
  ...JOB_ACTIONS,
  ...ASSET_ACTIONS,
  ...CANVAS_ACTIONS,
  ...SCENE_ACTIONS,
  ...GIT_ACTIONS,
  ...SETTINGS_ACTIONS,
]

/** The share of the registry one door offers. `mcp` is everything; `both` is the short list. */
export function actionsReaching(reach: ActionReach): readonly AssistantAction[] {
  return reach === 'mcp' ? ACTION_REGISTRY : ACTION_REGISTRY.filter(entry => entry.reach === 'both')
}

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

export function assistantAction(name: string): AssistantAction | null {
  return ACTION_REGISTRY.find(descriptor => descriptor.name === name) ?? null
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
