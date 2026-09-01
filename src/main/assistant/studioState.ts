import { primaryRoleOf } from '@shared/domain/aiRole'
import type {
  SnapshotDocument,
  SnapshotTask,
  SnapshotSelection,
  StudioSnapshot,
} from '@shared/domain/studioSnapshot'
import type { PlayState } from '@shared/domain/gameRuntime'
import { FAMILY_BY_WORKSPACE, isWorkspaceId } from '@shared/domain/workspace'
import { parseSnapshot } from './validation'
import { projectName } from '@shared/domain/project'

/**
 * What the studio is, as sentences the model reads before it decides anything.
 *
 * 🛑 Composed from the answer `studio.state` gives an MCP client, and from nothing else: the
 * assistant and a program on the wire then see ONE studio, where a second reading would drift
 * the first time a surface moved.
 */

/** How many of the other open documents are named. Beyond this the list is noise in a prompt. */
const OTHERS_NAMED = 3

/** How many selected things are named, for the same reason. */
const SELECTED_NAMED = 4

/** How many running tasks are named, for the same reason. */
const TASKS_NAMED = 2

/**
 * 🛑 What the whole block may cost the briefing. Its twin `context` is capped where it is composed
 * (`CONTEXT_COMPOSED_MAX`); this one is built from titles, node names and model ids a person
 * chose, so nothing else bounds it — and on Scenario's door every character here is one the
 * sentence does not get.
 */
export const STATE_MAX = 700

/**
 * The head of a block, by whole LINES: half a sentence about which model is armed is worse than
 * no sentence. Used twice — here against `STATE_MAX`, and by the briefing against the room a
 * door actually leaves, which is smaller on the narrowest one.
 */
export function linesWithin(text: string, max: number): string {
  if (text.length <= max) return text

  const kept: string[] = []
  let left = max
  for (const line of text.split('\n')) {
    if (line.length + 1 > left) break
    left -= line.length + 1
    kept.push(line)
  }

  return kept.join('\n')
}

const quoted = (name: string): string => `"${name || 'Untitled'}"`

function frontLine(front: SnapshotDocument | undefined, open: number): string {
  if (front) {
    const unsaved = front.modified ? ', with unsaved changes.' : '.'
    return `  In front: ${quoted(front.title)} (${front.kind})${unsaved}`
  }

  // Not "no document is open", which the rule about making one would then act on: documents ARE
  // open, and none of them is active.
  return open === 0
    ? '  In front: nothing. No document is open.'
    : '  In front: nothing — documents are open, but none of them is active.'
}

function documentLines(documents: readonly SnapshotDocument[]): string[] {
  const front = documents.find(one => one.active)
  const others = documents.filter(one => one !== front)
  const lines = [frontLine(front, documents.length)]
  if (others.length === 0) return lines

  const named = others.slice(0, OTHERS_NAMED).map(one => `${quoted(one.title)} (${one.workspace})`)
  const rest = others.length - named.length

  return [...lines, `  Also open: ${named.join(', ')}${rest > 0 ? `, and ${rest} more` : ''}.`]
}

function selectionLine(selection: SnapshotSelection | null): string[] {
  if (selection === null || selection.items.length === 0) return []

  const named = selection.items
    .slice(0, SELECTED_NAMED)
    .map(one => quoted(one.name))
    .join(', ')
  const count = selection.items.length
  const plural = count > 1 ? `${count} ${selection.kind}s` : `one ${selection.kind}`

  // A layer is where an edit LANDS, which is not the same as a thing the person pointed at: the
  // studio always has an active one, and calling that "selected" aims "delete it" at it.
  return selection.kind === 'layer'
    ? [`  Edits land on: ${plural} — ${named}.`]
    : [`  Selected: ${plural} — ${named}.`]
}

/** The model armed for the space in front, which is the one a generation would run on. */
function armedLine(state: StudioSnapshot): string[] {
  if (!isWorkspaceId(state.workspace)) return []

  const family = FAMILY_BY_WORKSPACE[state.workspace]
  // Code arms nothing — no family, so no sentence about a model that would never be run.
  if (family === null) return []

  const role = primaryRoleOf(family)
  const modelId = role === null ? undefined : state.armedModels[role]

  return [
    modelId
      ? `  Armed for ${family}: ${modelId}. Use this id unless the person asks for another.`
      : `  No model is armed for ${family}. models.search then models.select before generating.`,
  ]
}

/**
 * 🛑 The id and not the count: `task.cancelLocalTask` takes one, and nothing else in a briefing
 * publishes it — « arrête la tâche d'indexation qui tourne » read `jobs.list`, which holds cloud
 * generations alone, and answered that nothing was running.
 */
function taskLines(tasks: readonly SnapshotTask[]): string[] {
  if (tasks.length === 0) return []

  const named = tasks
    .slice(0, TASKS_NAMED)
    .map(one => `${quoted(one.label)} (${one.id}, ${Math.round(one.ratio * 100)}%)`)
  const rest = tasks.length - named.length

  return [
    `  Running here: ${named.join(', ')}${rest > 0 ? `, and ${rest} more` : ''}.`,
    '  task.cancelLocalTask stops one by its id.',
  ]
}

/**
 * 🛑 Said only while a game is UNDER WAY, and it names the calls: nothing else in the briefing
 * announces one, so « où en est la partie ? » was answered off the document block and « reprends
 * la partie » without a single call. The tick stays out — `runtime.report` answers it, and a
 * number here would be read instead of called.
 */
function playLine(play: PlayState): string[] {
  if (play === 'playing')
    return ['  A game is RUNNING on the scene in front. runtime.report says where it is.']

  return play === 'paused'
    ? ['  A game is PAUSED on the scene in front. play.step advances it, play.resume carries on.']
    : []
}

/**
 * 🛑 Said only once the window KNOWS. `project` starts `null` meaning "not asked yet", and a turn
 * fired before the answer landed would tell the model there is no project over an open one.
 */
function projectLine(state: StudioSnapshot): string[] {
  if (state.project) return [`  Project: ${quoted(projectName(state.project.path))}.`]

  return state.projectKnown ? ['  No project is open, so no document can be created.'] : []
}

/**
 * The state block, or nothing at all when the window could not answer — an assistant told half a
 * studio decides worse than one told none.
 */
export function describeStudio(data: unknown): string {
  const state = parseSnapshot(data)
  if (state === null) return ''

  const lines = [
    'Studio now:',
    // 🛑 The command SCOPE beside the space, because the rule of `command.runStudioCommand` sends
    // a model here for it: an image document is kind `image` and scope `canvas`, so a model
    // reading the kind composed `image.undo`, which no command answers to.
    `  Space: ${state.workspace}${state.surface === state.workspace ? '' : `, showing ${state.surface}`}${state.commandScope === null ? '' : `. Commands here are ${state.commandScope}.<verb>`}.`,
    ...documentLines(state.documents),
    ...selectionLine(state.selection),
    ...armedLine(state),
    ...projectLine(state),
    ...(state.authKnown && !state.authenticated
      ? ['  Not signed in: nothing can be generated.']
      : []),
    // 🛑 LAST, behind the armed model, the project and the sign-in: `linesWithin` breaks on the
    // first line that does not fit, so a line placed ahead of those takes them down on a
    // saturated briefing. What STOPS an action outranks what merely tells of one under way.
    ...playLine(state.play),
    ...taskLines(state.tasks),
  ]

  return linesWithin(lines.join('\n'), STATE_MAX)
}
