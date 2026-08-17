import type { FieldKind } from './model'

/**
 * What an action IS, apart from which actions there are.
 *
 * Split from `assistant.ts` so a family of actions can be declared in its own module without
 * importing the registry that collects them — the cycle `import-cycles.test.ts` holds at zero.
 * The registry, and everything that reads one particular action, stays there.
 */

/**
 * Every action the studio publishes, in one list.
 *
 * Written out rather than composed from the family modules, and that is the point: the union
 * cannot live beside the tables without those tables importing it back. One list also reads as
 * the table of contents it is, and `assistant.test.ts` holds it to the registry in both
 * directions — a name declared here and never built is as much a defect as the reverse.
 */
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
  | 'chat.close'
  | 'studio.state'
  | 'documents.list'
  | 'document.open'
  | 'document.activate'
  | 'document.close'
  | 'document.rename'
  | 'activity.recent'
  | 'project.open'
  | 'project.create'
  | 'files.list'
  | 'files.search'
  | 'files.move'
  | 'files.copy'
  | 'files.duplicate'
  | 'files.trash'
  | 'file.rename'
  | 'file.facts'
  | 'folder.new'
  | 'model.schema'
  | 'cost.estimate'
  | 'job.get'
  | 'job.wait'
  | 'job.cancel'
  | 'usage.report'
  | 'assets.search'
  | 'assets.counts'
  | 'asset.get'
  | 'asset.update'
  | 'assets.remove'

/**
 * What running an action leaves behind, and therefore whether it may run without being asked.
 *
 * - `none` — undoable, and nothing outlives the window.
 * - `files` — moves, renames or bins something in the project folder, or drops unsaved work.
 *   The Explorer can undo it, but the disk has already changed and another program may have
 *   read it since.
 * - `asset` — uploads a picture, which becomes a permanent asset in the user's library.
 * - `credits` — spends real money. Confirmed, and the estimate is stated first.
 *
 * The distinction matters at the moment of asking: only `credits` has a figure to quote, and
 * inventing one for the others would be worse than admitting there is none.
 *
 * `files` is deliberately narrow — destroying, moving or renaming — and NOT "anything that
 * writes". A new folder and a duplicate add something nobody loses, and a studio that asked
 * about those would teach its user to click Allow without reading.
 */
export type ActionCommitment = 'none' | 'files' | 'asset' | 'credits'

export const ACTION_COMMITMENTS: readonly ActionCommitment[] = ['none', 'files', 'asset', 'credits']

/**
 * Which of the two doors offers this action.
 *
 * `both` is the assistant inside the window AND an outside client; `mcp` is the client alone.
 * The asymmetry is forced and measured: the assistant's model is told the whole catalogue in a
 * prompt capped at `INSTRUCTION_MAX`, so a registry of eighty actions would leave no room for
 * the sentence the person typed. An outside client reads `tools/list`, which has no such cap.
 *
 * `both` is therefore the vocabulary of a spoken request, and `mcp` everything a program drives
 * deliberately — file trees, layer stacks, git. `instruction.ts` filters; `tools.ts` does not.
 */
export type ActionReach = 'both' | 'mcp'

/**
 * One input of an action.
 *
 * Deliberately NOT `FieldDescriptor`: that one carries `label`, a sentence the Scenario API
 * writes and the form shows as-is. A static registry cannot hold a sentence — every word bound
 * for the screen lives in a bundle — so this carries `labelKey` instead.
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
  /** A list of `kind` rather than one of it. `raw` stays a single value — it is already open. */
  repeated?: boolean
}

export type AssistantAction = {
  name: ActionName
  titleKey: string
  /** Never optional: an action the model cannot be told the purpose of is one it will misuse. */
  descriptionKey: string
  commitment: ActionCommitment
  reach: ActionReach
  fields: readonly ActionField[]
}

/** Identity, for the type annotation it forces on every entry of a family table. */
export function action(descriptor: AssistantAction): AssistantAction {
  return descriptor
}

/**
 * Why an action did not run.
 *
 * Shared rather than private to the executor, because the sentence is read twice and in two
 * languages: the person watching the modal reads their own, and the model deciding what to try
 * next reads English. Both renderings come from the bundles.
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
  /** The form moved between the figure being quoted and the yes. What was priced is what goes. */
  | 'formChanged'

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
  'formChanged',
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

/** Whether running this needs a yes first. `asset` and `credits` do; only `credits` quotes a figure. */
export function needsConfirmation(commitment: ActionCommitment): boolean {
  return commitment !== 'none'
}

/** What each kind accepts, as a check rather than as a name. `raw` takes anything defined. */
function fits(field: ActionField, value: unknown): boolean {
  switch (field.kind) {
    case 'text':
    case 'longText':
    case 'choice':
    case 'color':
    case 'image':
      return typeof value === 'string' && (!field.options || field.options.includes(value))
    case 'number':
    case 'integer':
    case 'seed':
      return (
        typeof value === 'number' &&
        Number.isFinite(value) &&
        (field.kind === 'number' || Number.isInteger(value)) &&
        (field.min === undefined || value >= field.min) &&
        (field.max === undefined || value <= field.max)
      )
    case 'boolean':
      return typeof value === 'boolean'
    case 'raw':
      return value !== undefined
  }
}

/**
 * Whether this input may be handed to the action's own code.
 *
 * The one validator for all three callers — the modal, an MCP client, and the reply parser —
 * and it is derived from `fields` rather than written per action, which is what makes eighty
 * actions cost no more to guard than eleven. Before it existed each handler read its own inputs
 * defensively and the ones that forgot were guarded by nothing at all.
 *
 * A key nobody declared is a refusal rather than a value ignored: the schema promises
 * `additionalProperties: false`, and a client that got a silent yes for a misspelt key would
 * believe the value took.
 */
export function validatesInput(
  fields: readonly ActionField[],
  input: Record<string, unknown>,
): boolean {
  for (const key of Object.keys(input)) {
    if (!fields.some(field => field.key === key)) return false
  }

  return fields.every(field => {
    const value = input[field.key]
    if (value === undefined) return !field.required

    if (!field.repeated) return fits(field, value)
    return Array.isArray(value) && value.every(item => fits(field, item))
  })
}
