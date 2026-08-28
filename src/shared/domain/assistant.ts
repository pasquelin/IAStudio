import { englishText } from '../i18n'
import type { Target } from './target'
import { searchWords } from '../text'
import {
  type ActionCommitment,
  type ActionName,
  type AssistantAction,
  type ActionReach,
} from './assistantAction'
import { ASSET_ACTIONS } from './assetActions'
import { CANVAS_ACTIONS } from './canvasActions'
import { CLOUD_ACTIONS } from './cloudActions'
import { CORE_ACTIONS } from './coreActions'
import { FILE_ACTIONS } from './fileActions'
import { GIT_ACTIONS } from './gitActions'
import { JOB_ACTIONS } from './jobActions'
import { MATERIAL_ACTIONS } from './materialActions'
import { RIG_ACTIONS } from './rigActions'
import { POST_ACTIONS } from './postActions'
import { SCENE_ACTIONS } from './sceneActions'
import { SEQUENCE_ACTIONS } from './sequenceActions'
import { CONTEXT_ACTIONS } from './contextActions'
import { MEMORY_ACTIONS } from './memoryActions'
import {
  ASSEMBLY_ACTIONS,
  EXPORT_ACTIONS,
  GAME_ACTIONS,
  PLAY_ACTIONS,
  SCRIPT_ACTIONS,
  STUDIO_ACTIONS,
  TIMELINE_ACTIONS,
} from './gameActions'
import { SETTINGS_ACTIONS } from './settingsActions'
import { SHELL_ACTIONS } from './shellActions'
import { TARGET_ACTIONS } from './targetActions'
import { STATE_ACTIONS } from './stateActions'

/**
 * What the assistant is allowed to do on the user's behalf, and how each thing is described to
 * the model that chooses it — see spec § 9.
 *
 * One table, read by two surfaces that must never disagree: the assistant inside the window,
 * which lists the model as much of it as its brain has room for, and the MCP server, which
 * publishes all of it as tools. What the assistant is SHOWN is decided by that room —
 * `studioBriefing` — and `reach` only names the short share it falls back to.
 */

export * from './assistantAction'
export * from './assistantModel'

export { commitmentOfCommand } from './coreActions'

/**
 * Every action the studio publishes, one family after another.
 *
 * Order matters to one reader only — the assistant's model reads its share in this order — so
 * the spoken vocabulary comes first and the families a program drives follow.
 *
 * 🛑 The families are DATA, not a spread: the briefing heads its catalogue with them, and read
 * off the first token of a name instead it cut 231 actions into 83 headings that grouped nothing
 * — `model.schema` and `model.textures` belong to two families and shared a heading.
 */
export const ACTION_FAMILIES: readonly ActionFamily[] = [
  { name: 'core', actions: CORE_ACTIONS },
  { name: 'target', actions: TARGET_ACTIONS },
  { name: 'state', actions: STATE_ACTIONS },
  { name: 'file', actions: FILE_ACTIONS },
  { name: 'job', actions: JOB_ACTIONS },
  { name: 'asset', actions: ASSET_ACTIONS },
  { name: 'cloud', actions: CLOUD_ACTIONS },
  { name: 'canvas', actions: CANVAS_ACTIONS },
  { name: 'montage', actions: SEQUENCE_ACTIONS },
  { name: 'material', actions: MATERIAL_ACTIONS },
  { name: 'scene', actions: SCENE_ACTIONS },
  { name: 'post', actions: POST_ACTIONS },
  { name: 'rig', actions: RIG_ACTIONS },
  { name: 'git', actions: GIT_ACTIONS },
  { name: 'game', actions: GAME_ACTIONS },
  { name: 'play', actions: PLAY_ACTIONS },
  { name: 'script', actions: SCRIPT_ACTIONS },
  { name: 'studio', actions: STUDIO_ACTIONS },
  { name: 'timeline', actions: TIMELINE_ACTIONS },
  { name: 'assembly', actions: ASSEMBLY_ACTIONS },
  { name: 'export', actions: EXPORT_ACTIONS },
  { name: 'context', actions: CONTEXT_ACTIONS },
  { name: 'memory', actions: MEMORY_ACTIONS },
  { name: 'settings', actions: SETTINGS_ACTIONS },
  { name: 'shell', actions: SHELL_ACTIONS },
]

/** One family of the registry: what a briefing heads a run of actions with. */
export type ActionFamily = { readonly name: string; readonly actions: readonly AssistantAction[] }

/** Derived, never restated: a family added above is in the registry on the spot. */
export const ACTION_REGISTRY: readonly AssistantAction[] = ACTION_FAMILIES.flatMap(
  family => family.actions,
)

/** Which family publishes each action — what the catalogue's headings are read from. */
export const familyOfAction: ReadonlyMap<string, string> = new Map(
  ACTION_FAMILIES.flatMap(family => family.actions.map(one => [one.name, family.name])),
)

/**
 * The share of the registry one door offers. `mcp` is everything; `both` is the short list.
 *
 * A `switch` rather than a ternary: `reach === 'mcp' ? ALL : …` made publishing EVERYTHING the
 * fallback, so a third value would have gone out on the MCP wire with nothing red. Here it leaves
 * the function without a return path, and the compiler says so.
 */
export function actionsReaching(reach: ActionReach): readonly AssistantAction[] {
  switch (reach) {
    case 'both':
      return ACTION_REGISTRY.filter(entry => entry.reach === 'both')
    case 'mcp':
      return ACTION_REGISTRY
  }
}

/**
 * Every action's own words, folded once for the process: 225 bundle walks and as many regexes,
 * none of which depends on the query — and `actions.find` runs this on the UI thread.
 */
type Searchable = { readonly action: AssistantAction; readonly words: readonly string[] }

let searchableHeld: readonly Searchable[] | null = null

const searchable = (): readonly Searchable[] =>
  (searchableHeld ??= ACTION_REGISTRY.filter(entry => entry.name !== DISCOVERY_ACTION).map(
    action => ({
      action,
      words: searchWords(`${action.name} ${englishText(action.descriptionKey)}`),
    }),
  ))

/**
 * The actions a word or two points at, best first — how a model shown the short list asks for
 * the rest of the registry.
 *
 * Matched on the name and on the ENGLISH description, which is what a model is shown of an
 * action it can already see: one text for both, or a search would find what the catalogue does
 * not describe. Prefix matching rather than equality, so "layer" finds "layers".
 */
export function findActions(query: string): readonly AssistantAction[] {
  const wanted = searchWords(query)
  if (wanted.length === 0) return []

  return (
    searchable()
      .map(one => ({ action: one.action, score: scoreOf(wanted, one.words) }))
      .filter(hit => hit.score > 0)
      // Stable, so equal scores stay in registry order — the order the families were written in.
      .sort((first, second) => second.score - first.score)
      .map(hit => hit.action)
  )
}

const scoreOf = (wanted: readonly string[], found: readonly string[]): number =>
  wanted.filter(word => found.some(one => one.startsWith(word))).length

/**
 * The action a brain answers ITSELF, to hand a model the share of the catalogue it was not shown
 * — see `answeredTurn`. Named here because two modules must leave it out of what they list and
 * of what they search, and a name spelled twice is a name that drifts.
 */
export const DISCOVERY_ACTION: ActionName = 'actions.find'

/** One thing the assistant decided to do. Checked against the registry before it is run. */
export type AssistantCall = { action: ActionName; input: Record<string, unknown> }

/** What is asked of whatever does the thinking. */
export type AssistantThought = {
  utterance: string
  /**
   * This is not the first round on this sentence: what has already been done, and what each
   * action answered, is in `history`.
   *
   * The window's to say, because the chain is the window's: it is what turns "search, then open
   * what you found" into two rounds instead of one plan that cannot be written in advance.
   */
  continuing?: boolean
  /**
   * The turns before this one, oldest first, already rendered as lines. Rendered rather than
   * structured because that is what a model reads, and because the implementation the studio
   * ships can only carry ten blocks of text.
   */
  history: readonly string[]
  /**
   * What the open project is about, already composed — see `composedContext`.
   *
   * 🛑 Filled in the MAIN process, never by a window: `parseThought` does not declare it, so zod
   * strips one that arrived over the boundary. A context a renderer could name is a context a
   * renderer could forge.
   */
  context?: string
  /**
   * What the studio is right now — the space, the document in front, the model armed, what is
   * selected — already in sentences. See `describeStudio`.
   *
   * 🛑 Filled in the MAIN process, by the same route and for the same reason as `context`: it is
   * ASKED of the window in front, through the door an MCP client reads `studio.state` by, rather
   * than taken from whatever a renderer chose to send.
   */
  state?: string
  /**
   * How many memories this project holds — see `assistantMemory.ts`.
   *
   * 🛑 A COUNT and not the memories: what a briefing says is that a memory EXISTS and how to ask
   * it, never what it holds. Filled in the MAIN process, by the same route and for the same
   * reason as `context` and `state`: `parseThought` does not declare it, so zod strips one that
   * arrived over the boundary.
   */
  memories?: number
  /**
   * What the open document can be aimed at, narrowed by the window — see `target.ts`.
   *
   * Unlike `context` and `state` this one IS the renderer's to name: it describes its own window,
   * and every id is checked against the live document by the handler before anything moves.
   */
  targets?: readonly Target[]
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
  const action = assistantAction(name)
  if (!action) return 'none'

  return action.raises?.(input) ?? action.commitment
}
