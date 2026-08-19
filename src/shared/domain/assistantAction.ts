import { HEX_COLOR } from './color'
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
 * Written out rather than composed from the family modules: the union cannot live beside the
 * tables without those tables importing it back. The compiler holds families → union; only
 * `exhaustive.test.ts` holds union → families, and it has to — a name declared here and never
 * built leaves the registry and the handler table in perfect agreement about nothing.
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
  | 'document.save'
  | 'document.remove'
  | 'document.export'
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
  | 'canvas.state'
  | 'canvas.resize'
  | 'canvas.crop'
  | 'canvas.orient'
  | 'layer.add'
  | 'layer.remove'
  | 'layer.select'
  | 'layer.rename'
  | 'layer.style'
  | 'layer.transform'
  | 'layer.text'
  | 'layer.move'
  | 'layer.duplicate'
  | 'layer.group'
  | 'layer.ungroup'
  | 'layer.mergeDown'
  | 'sequence.state'
  | 'sequence.seek'
  | 'clip.add'
  | 'clip.remove'
  | 'clip.move'
  | 'clip.trim'
  | 'clip.split'
  | 'clip.fade'
  | 'clip.gain'
  | 'clip.speed'
  | 'clip.unlink'
  | 'clip.select'
  | 'track.add'
  | 'track.remove'
  | 'track.move'
  | 'track.rename'
  | 'track.adjust'
  | 'skybox.state'
  | 'skybox.adjust'
  | 'skybox.resetAdjustments'
  | 'skybox.sun'
  | 'skybox.environment'
  | 'skybox.source'
  | 'texture.state'
  | 'texture.material'
  | 'texture.preview'
  | 'texture.channel'
  | 'styles.list'
  | 'style.save'
  | 'style.rename'
  | 'style.remove'
  | 'cloud.browse'
  | 'cloud.explore'
  | 'cloud.similar'
  | 'cloud.plan'
  | 'cloud.pull'
  | 'cloud.push'
  | 'auth.state'
  | 'window.state'
  | 'window.fullScreen'
  | 'settings.open'
  | 'updates.state'
  | 'media.capabilities'
  | 'media.adopt'
  | 'fonts.list'
  | 'favorites.list'
  | 'favorite.pin'
  | 'favorite.unpin'
  | 'fileInfo.open'
  | 'mirror.open'
  | 'scene.state'
  | 'node.add'
  | 'node.addModel'
  | 'node.remove'
  | 'node.rename'
  | 'node.transform'
  | 'node.visible'
  | 'node.material'
  | 'node.light'
  | 'node.camera'
  | 'camera.shot'
  | 'camera.rail'
  | 'camera.target'
  | 'node.reparent'
  | 'node.select'
  | 'git.status'
  | 'git.log'
  | 'git.commitFiles'
  | 'git.diff'
  | 'git.branches'
  | 'git.stashes'
  | 'git.init'
  | 'git.stage'
  | 'git.unstage'
  | 'git.restore'
  | 'git.commit'
  | 'git.createBranch'
  | 'git.checkout'
  | 'git.stash'
  | 'git.stashPop'
  | 'git.tag'
  | 'git.stashDrop'
  | 'git.resolve'
  | 'git.abortMerge'
  | 'git.remotes'
  | 'git.addRemote'
  | 'git.fetch'
  | 'git.pull'
  | 'git.push'
  | 'settings.read'
  | 'settings.write'
  | 'accounts.list'
  | 'accounts.activate'

/**
 * What running an action leaves behind, and therefore whether it may run without being asked.
 *
 * - `none` — undoable, and nothing outlives the window.
 * - `files` — moves, renames or bins something in the project folder, or drops unsaved work.
 *   The Explorer can undo it, but the disk has already changed and another program may have
 *   read it since.
 * - `asset` — uploads a picture, which becomes a permanent asset in the user's library.
 * - `remote` — publishes to a server outside this machine. Costs nothing and destroys nothing
 *   locally, and that is exactly why the other levels do not describe it: what leaves cannot be
 *   called back, and no undo on this machine reaches it.
 * - `credits` — spends real money. Confirmed, and the estimate is stated first.
 *
 * The distinction matters at the moment of asking: only `credits` has a figure to quote, and
 * inventing one for the others would be worse than admitting there is none.
 *
 * `files` is deliberately narrow — destroying, moving or renaming — and NOT "anything that
 * writes". A new folder and a duplicate add something nobody loses, and a studio that asked
 * about those would teach its user to click Allow without reading.
 */
export type ActionCommitment = 'none' | 'files' | 'asset' | 'remote' | 'credits'

export const ACTION_COMMITMENTS: readonly ActionCommitment[] = [
  'none',
  'files',
  'asset',
  'remote',
  'credits',
]

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

export const ACTION_REACHES: readonly ActionReach[] = ['both', 'mcp']

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
  /** The floor. What one CALL engages may be higher — see `raises`. */
  commitment: ActionCommitment
  /**
   * What this call engages, when its own input decides — a command that uploads, an amend that
   * rewrites a version, a removal that reaches the remote library.
   *
   * On the descriptor rather than as names spelled out in `commitmentOfCall`: that function held
   * one action by name, and the two others that needed it silently did not get it.
   */
  raises?: (input: Record<string, unknown>) => ActionCommitment
  /**
   * The handler may put its own question on screen and wait for a person — whether it does is the
   * handler's own business (a dirty document, a missing title). `commitment` stays at the floor so
   * no SECOND question is raised, which is what made the tool announce "Runs straight away".
   */
  asksItself?: true
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
  /** A path is relative to a project, and there is none open to be relative to. */
  | 'noProject'
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
  /** Well formed, and its target is not there. A client told `badInput` retries the parameters. */
  | 'notFound'
  /** A call from outside may not do this at all. Never a person's refusal — that is `declined`. */
  | 'notAllowed'
  /** The document in front carries nothing to render. Three causes, one honest answer. */
  | 'notRenderable'
  /** It was tried and it did not go through. The journal holds the reason; the input was not it. */
  | 'failed'

export const ACTION_REFUSALS: readonly ActionRefusal[] = [
  'unknownCommand',
  'globalCommand',
  'wrongSurface',
  'generatorClosed',
  'nothingPrepared',
  'notSubmitted',
  'badInput',
  'noBridge',
  'noProject',
  'noConfirmer',
  'declined',
  'noWindow',
  'timedOut',
  'noReference',
  'formChanged',
  'notFound',
  'notAllowed',
  'notRenderable',
  'failed',
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

/**
 * The sentence a commitment is announced with. Keyed rather than branched on, so a fifth level
 * cannot fall silently into the wrong question — which a chain of `if` in the modal would let it.
 */
export function confirmKey(commitment: ActionCommitment): string {
  return `assistant.confirm.${commitment}`
}

/** Whether running this needs a yes first. Only `credits` quotes a figure. */
export function needsConfirmation(commitment: ActionCommitment): boolean {
  return commitment !== 'none'
}

/** A refusal, spelled once for the ten modules that hand one back. */
export const refused = (refusal: ActionRefusal): ActionOutcome => ({ ok: false, refusal })

/**
 * What each kind accepts, as a check rather than as a name.
 *
 * A required `text` may not be blank, and a required `repeated` may not be empty — see
 * `validatesInput`. Both were left to the handlers first, which meant one `=== ''` and one
 * `length === 0` per action, and a handler that forgot either had nothing behind it.
 */
function fits(field: ActionField, value: unknown): boolean {
  switch (field.kind) {
    case 'text':
    case 'longText':
    case 'choice':
    case 'image':
    case 'mesh':
      return (
        typeof value === 'string' &&
        (!field.required || value.trim() !== '') &&
        (!field.options || field.options.includes(value))
      )
    // Apart from the strings, because every reader of a colour falls back SILENTLY on a value it
    // cannot parse — the paint never took, and the caller was told it did.
    case 'color':
      return typeof value === 'string' && HEX_COLOR.test(value)
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
    // `Object.keys` rather than `in`, which answers true for `__proto__`, `toString` and
    // `constructor` — names that reached a merge, vanished in it, and were answered `ok`.
    case 'record':
      return (
        typeof value === 'object' &&
        value !== null &&
        !Array.isArray(value) &&
        Object.keys(value).every(key => field.options?.includes(key) ?? true)
      )
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

    return (
      Array.isArray(value) &&
      (!field.required || value.length > 0) &&
      value.every(item => fits(field, item))
    )
  })
}
