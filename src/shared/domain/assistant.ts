import {
  type ActionCommitment,
  type ActionName,
  type AssistantAction,
  type ActionReach,
} from './assistantAction'
import { ASSET_ACTIONS } from './assetActions'
import { CANVAS_ACTIONS } from './canvasActions'
import { CORE_ACTIONS } from './coreActions'
import { FILE_ACTIONS } from './fileActions'
import { GIT_ACTIONS } from './gitActions'
import { JOB_ACTIONS } from './jobActions'
import { MATERIAL_ACTIONS } from './materialActions'
import { SCENE_ACTIONS } from './sceneActions'
import { SEQUENCE_ACTIONS } from './sequenceActions'
import { SETTINGS_ACTIONS } from './settingsActions'
import { SHELL_ACTIONS } from './shellActions'
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
export * from './assistantModel'

export { commitmentOfCommand } from './coreActions'

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
  ...SEQUENCE_ACTIONS,
  ...MATERIAL_ACTIONS,
  ...SCENE_ACTIONS,
  ...GIT_ACTIONS,
  ...SETTINGS_ACTIONS,
  ...SHELL_ACTIONS,
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
  const action = assistantAction(name)
  if (!action) return 'none'

  return action.raises?.(input) ?? action.commitment
}
