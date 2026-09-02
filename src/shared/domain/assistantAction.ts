import { HEX_COLOR } from './color'
import type { FieldKind } from './model'
import { ENVIRONMENT_KINDS } from './scene'

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
  | 'command.runStudioCommand'
  | 'workspace.open'
  | 'models.search'
  | 'models.select'
  | 'generator.prepare'
  | 'generator.readArmedGeneration'
  | 'generator.submit'
  | 'jobs.list'
  | 'prompt.suggest'
  | 'prompt.translate'
  | 'prompt.describeStyle'
  | 'chat.close'
  | 'actions.find'
  | 'target.select'
  | 'studio.state'
  | 'documents.list'
  | 'document.open'
  | 'document.activate'
  | 'document.close'
  | 'document.rename'
  | 'document.save'
  | 'document.deleteFromDisk'
  | 'document.export'
  | 'activity.recent'
  | 'projects.list'
  | 'project.open'
  | 'project.close'
  | 'project.create'
  | 'project.forget'
  | 'project.trash'
  | 'file.open'
  | 'files.list'
  | 'files.search'
  | 'files.move'
  | 'files.copy'
  | 'files.duplicate'
  | 'files.trash'
  | 'files.undoFileOperation'
  | 'files.redoFileOperation'
  | 'files.canUndoRedo'
  | 'file.rename'
  | 'file.facts'
  | 'file.reveal'
  | 'folder.new'
  | 'project.rename'
  | 'models.readGenerationModelFields'
  | 'cost.estimate'
  | 'job.readCloudGeneration'
  | 'job.waitForCloudGeneration'
  | 'job.cancelCloudGeneration'
  | 'task.cancelLocalTask'
  | 'usage.report'
  | 'assets.searchProjectCatalogue'
  | 'assets.counts'
  | 'assets.listMissing'
  | 'assets.captionImages'
  | 'asset.get'
  | 'asset.update'
  | 'asset.reveal'
  | 'asset.extractTextures'
  | 'assets.removeFromLibrary'
  | 'canvas.state'
  | 'canvas.resize'
  | 'canvas.setPixelArt'
  | 'canvas.drawPixels'
  | 'canvas.crop'
  | 'canvas.flipOrRotate'
  | 'layer.add'
  | 'layer.remove'
  | 'layer.select'
  | 'layer.rename'
  | 'layer.setOpacityBlendAndVisibility'
  | 'layer.transform'
  | 'layer.editTextLayer'
  | 'layer.reorderInStack'
  | 'layer.duplicate'
  | 'layer.group'
  | 'layer.ungroup'
  | 'layer.mergeDown'
  | 'layer.lock'
  | 'layer.editShapeLayer'
  | 'layer.setAdjustmentAmount'
  | 'layer.setMaskOptions'
  | 'guide.add'
  | 'guide.move'
  | 'guide.remove'
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
  | 'track.reorderTracks'
  | 'track.rename'
  | 'track.setMuteSoloLockHeight'
  | 'skybox.state'
  | 'skybox.setViewportOptions'
  | 'skybox.adjustImage'
  | 'skybox.resetAdjustments'
  | 'skybox.setSun'
  | 'skybox.setPreviewLighting'
  | 'skybox.setSourceImage'
  | 'material.state'
  | 'material.setSurfaceSettings'
  | 'material.setPreviewEnvironment'
  | 'material.setPreviewDisplay'
  | 'material.setChannelImage'
  | 'styles.list'
  | 'style.save'
  | 'style.rename'
  | 'style.remove'
  | 'cloud.browseAccountLibrary'
  | 'cloud.explorePublicFeed'
  | 'cloud.findSimilarPublished'
  | 'cloud.previewSync'
  | 'cloud.pull'
  | 'cloud.push'
  | 'auth.state'
  | 'window.state'
  | 'window.fullScreen'
  | 'settings.open'
  | 'updates.state'
  | 'updates.install'
  | 'dictation.state'
  | 'dictation.start'
  | 'dictation.stop'
  | 'panels.list'
  | 'panel.open'
  | 'panel.close'
  | 'media.capabilities'
  | 'media.indexFileInPlace'
  | 'fonts.list'
  | 'favorites.listPinnedRecipes'
  | 'favorite.pinAssetRecipe'
  | 'favorite.unpinAssetRecipe'
  | 'fileInfo.openWindow'
  | 'mirror.openVideoReturnWindow'
  | 'help.openStudioWindow'
  | 'scene.state'
  | 'node.add'
  | 'node.addModel'
  | 'node.markAsCuttingTool'
  | 'node.combineIntoSolid'
  | 'node.swapSolidMatterAndTool'
  | 'node.separate'
  | 'node.remove'
  | 'node.attach'
  | 'node.rename'
  | 'node.transform'
  | 'node.setVisible'
  | 'node.setMeshMaterial'
  | 'node.setPrimitiveParameters'
  | 'node.setShadowCastAndReceive'
  | 'node.setSpriteSettings'
  | 'node.setTextSettings'
  | 'node.setPathShape'
  | 'path.addPoint'
  | 'path.movePoint'
  | 'path.removePoint'
  | 'node.setLightSettings'
  | 'node.setCameraLens'
  | 'model.setMaterialDocument'
  | 'model.setBaseColorImage'
  | 'camera.addShot'
  | 'camera.bindPathToShot'
  | 'camera.createAndBindPath'
  | 'camera.aimShotAt'
  | 'camera.reorder'
  | 'node.reparent'
  | 'node.select'
  | 'view.direction'
  | 'view.setDisplayMode'
  | 'scene.capture'
  | 'world.applyPreset'
  | 'world.setSceneLighting'
  | 'world.setBackground'
  | 'world.setFog'
  | 'world.setGroundPlane'
  | 'world.setToneMapping'
  | 'post.state'
  | 'post.add'
  | 'post.remove'
  | 'post.move'
  | 'post.set'
  | 'post.setEffectEnabled'
  | 'post.setWholeStackEnabled'
  | 'post.applyPreset'
  | 'post.listPresets'
  | 'post.duplicate'
  | 'post.reset'
  | 'post.addKeyframe'
  | 'post.removeKeyframe'
  | 'post.savePreset'
  | 'post.renamePreset'
  | 'post.deleteSavedPreset'
  | 'post.setCameraStackMode'
  | 'rig.state'
  | 'rig.fit'
  | 'rig.clear'
  | 'rig.configureHands'
  | 'bone.add'
  | 'bone.remove'
  | 'bone.rename'
  | 'bone.setRole'
  | 'socket.add'
  | 'socket.remove'
  | 'ik.add'
  | 'ik.remove'
  | 'animations.list'
  | 'animation.addBlock'
  | 'animation.removeBlock'
  | 'animation.setBlockSettings'
  | 'animation.setBandLengthAndRate'
  | 'animation.autoKey'
  | 'key.writePoseKeys'
  | 'key.removeSubjectKeys'
  | 'key.writeKeysOnOpenChannels'
  | 'key.move'
  | 'channel.remove'
  | 'channel.setMuteSoloLock'
  | 'git.status'
  | 'git.log'
  | 'git.listCommitFiles'
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
  | 'component.attach'
  | 'component.detach'
  | 'component.setProperties'
  | 'play.start'
  | 'play.stop'
  | 'play.pause'
  | 'play.resume'
  | 'play.step'
  | 'play.loadScene'
  | 'runtime.report'
  | 'runtime.errors'
  | 'script.list'
  | 'script.read'
  | 'script.write'
  | 'studio.describe'
  | 'studio.docs'
  | 'studio.batch'
  | 'timeline.addSceneCue'
  | 'timeline.removeSceneCue'
  | 'timeline.setPanelRows'
  | 'game.applyTemplate'
  | 'prefab.define'
  | 'prefab.instantiate'
  | 'game.export'
  | 'memory.recall'
  | 'memory.read'
  | 'memory.write'
  | 'memory.forget'
  | 'memory.link'
  | 'context.readProjectCards'
  | 'context.writeProjectCard'
  | 'context.deleteProjectCard'
  | 'settings.read'
  | 'settings.write'
  | 'settings.triggerAction'
  | 'accounts.list'
  | 'accounts.activate'
  | 'accounts.rename'

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
 * - `studio` — changes what the studio IS beyond the open document: which preferences hold,
 *   which account answers, which project is open. No ⌘Z reaches any of it, and the account is
 *   the one that decides whose library and whose invoice the next generation lands on. It is the
 *   only level with no delegation switch, and that is the point.
 * - `credits` — spends real money. Confirmed, and the estimate is stated first.
 *
 * The distinction matters at the moment of asking: only `credits` has a figure to quote, and
 * inventing one for the others would be worse than admitting there is none.
 *
 * `files` is deliberately narrow — destroying, moving or renaming — and NOT "anything that
 * writes". A new folder and a duplicate add something nobody loses, and a studio that asked
 * about those would teach its user to click Allow without reading.
 */
export type ActionCommitment = 'none' | 'files' | 'asset' | 'remote' | 'studio' | 'credits'

export const ACTION_COMMITMENTS: readonly ActionCommitment[] = [
  'none',
  'files',
  'asset',
  'remote',
  'studio',
  'credits',
]

/**
 * 🛑 VESTIGIAL, and said so rather than left to be discovered: the briefing shows every NAME on
 * every door since `studioBriefing` stopped composing manuals it was not asked for, so nothing
 * reads this but `actionsReaching('mcp')` — which both values answer. The wire carries all of it.
 *
 * `both` still reads as "the vocabulary of a spoken request" and `mcp` as "what a program drives",
 * but neither decides anything today. A new action may be marked either way without a consequence.
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
  /**
   * This value names a FOLDER of the machine, so the question can offer to point at one — the
   * model guesses a name where only the person knows where their work lives.
   *
   * 🛑 Not `PathKind`: the button's label says « dossier », and nothing would rougir on a field
   * that asked for a FILE under it. A second kind comes with a second label.
   */
  picks?: 'folder'
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
   * Whether a SECOND identical call, in one turn, can bring anything the first did not. False is
   * for what sets a surface or a session to a NAMED state; everything else is true, reading
   * included — `jobs.list` answers empty for a generation that has not registered yet, and a
   * model told not to repeat it would stop watching its own.
   *
   * 🛑 Blind spot, assumed: the guard reads this action's own last state and never its OPPOSITE,
   * so open/close/open of one panel — and pause/resume/pause, start/stop/start, pin/unpin/pin —
   * is refused on the third call, with a sentence saying the state stands when it no longer does.
   */
  repeatable: boolean
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
  /**
   * This one RUNS other actions, so an answer takes as long as everything it holds — pricing and
   * questions included. Read by `asking.ts`, which owes it the long wait, and by `tools.ts`.
   */
  runsOthers?: true
  reach: ActionReach
  fields: readonly ActionField[]
}

/** Identity, for the type annotation it forces on every entry of a family table. */
export function action(descriptor: AssistantAction): AssistantAction {
  return descriptor
}

/** The node in front, named the same way in every family that points at one. */
export const NODE_ID: ActionField = {
  key: 'nodeId',
  kind: 'text',
  labelKey: 'assistant.fields.nodeId',
  required: true,
}

/** How one works on a channel or a row — the same three flags, two families. */
export const MUTE_SOLO_LOCK: readonly ActionField[] = [
  { key: 'muted', kind: 'boolean', labelKey: 'assistant.fields.muted', required: false },
  { key: 'solo', kind: 'boolean', labelKey: 'assistant.fields.solo', required: false },
  { key: 'locked', kind: 'boolean', labelKey: 'assistant.fields.locked', required: false },
]

/**
 * What lights a surface, as the two registries that ask it both name it: a PICTURE by asset id,
 * a sky DOCUMENT by title. Naming one is enough — a document lit by an asset is `skybox` by that
 * fact alone, which spares a client two calls to do one thing. A document id is not something
 * anyone types, hence the TITLE.
 *
 * Written once because a fourth arm of `EnvironmentRef` would otherwise have to be added to two
 * registries, and nothing holds them together.
 */
export const ENVIRONMENT_FIELDS: readonly ActionField[] = [
  {
    key: 'kind',
    kind: 'choice',
    labelKey: 'assistant.fields.environmentKind',
    required: false,
    options: ENVIRONMENT_KINDS,
  },
  { key: 'assetId', kind: 'text', labelKey: 'assistant.fields.assetId', required: false },
  { key: 'sky', kind: 'text', labelKey: 'assistant.fields.skyDocument', required: false },
]

/**
 * 🛑 What turns « d'un mètre vers le haut » into one call instead of three.
 *
 * Without it a caller has to read the pose, do the arithmetic and write the result — measured on
 * the bench pass of 2026-08-26, section 7 scored 0 on five requests, every one of them written
 * as an absolute. The field's own label carries the rule, since that is what a model reads.
 */
export const RELATIVE_FIELD: ActionField = {
  key: 'relative',
  kind: 'boolean',
  labelKey: 'assistant.fields.relative',
  required: false,
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
  /** No surface mounted to take it — a scope with no panel up, a save with no tab in front. */
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
  /**
   * Two destinations, and the studio would have asked. Named rather than guessed: the wrong one
   * writes over a file somebody is editing — the options travel in the outcome's `data`.
   */
  | 'ambiguousLanding'
  /** The form moved between the figure being quoted and the yes. What was priced is what goes. */
  | 'formChanged'
  /** Well formed, and its target is not there. A client told `badInput` retries the parameters. */
  | 'notFound'
  /** A call from outside may not do this at all. Never a person's refusal — that is `declined`. */
  | 'notAllowed'
  /**
   * The command raises a native picker, which nothing here can fill or read back.
   *
   * 🛑 Its own reason and never `notAllowed`, whose sentence says "an appeal from outside": the
   * caller refused was the WINDOW's own assistant, and a refusal that misnames who was refused
   * teaches the model nothing it can act on. This one names the way through instead.
   */
  | 'nativeDialog'
  /** The document in front carries nothing to render. Three causes, one honest answer. */
  | 'notRenderable'
  /**
   * A call from the wire that engages something, met without a consent token. `detail` carries a
   * fresh one and what it covers, and the same call sent back with it runs.
   *
   * 🛑 The blind spot, and it is not closable from this side: the token proves the caller was
   * TOLD what the call engages, never that a person agreed. What it buys is that nothing engages
   * by accident, and that every engagement is named once in the open before it happens.
   */
  | 'needsConsent'
  /** It was tried and it did not go through. The journal holds the reason; the input was not it. */
  | 'failed'

export const ACTION_REFUSALS: readonly ActionRefusal[] = [
  'unknownCommand',
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
  'ambiguousLanding',
  'formChanged',
  'notFound',
  'notAllowed',
  'nativeDialog',
  'notRenderable',
  'needsConsent',
  'failed',
]

/**
 * What running an action answered.
 *
 * Shared rather than the window's own, since an action asked for from outside is answered back
 * across the boundary: the MCP server hands this to its client. A refusal carries a key rather
 * than a sentence, for the reason the list above gives — it is read in two languages.
 */
export type ActionOutcome =
  | { ok: true; data?: unknown }
  /**
   * `detail` says WHAT was wrong, in English and for a machine — never for the screen, which
   * reads `refusalKey`. A refusal that names nothing is one a caller cannot repair: measured on
   * the bench pass of 2026-08-25, 384 calls were sent again word for word after a refusal.
   */
  | { ok: false; refusal: ActionRefusal; detail?: string }

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
export const refused = (refusal: ActionRefusal, detail?: string): ActionOutcome => ({
  ok: false,
  refusal,
  ...(detail === undefined ? {} : { detail }),
})

/**
 * What each kind accepts, as a check rather than as a name.
 *
 * A required `text` may not be blank, and a required `repeated` may not be empty — see
 * `validatesInput`. Both were left to the handlers first, which meant one `=== ''` and one
 * `length === 0` per action, and a handler that forgot either had nothing behind it.
 *
 * 🛑 A PLACEHOLDER is refused here rather than explained later: `inputProblem` only speaks once
 * something else has already refused, so a lone `<path_id>` used to reach the handler and come
 * back as `notFound` — a hunt for a node whose name was never a name.
 */
const withinLength = (field: ActionField, value: string): boolean =>
  (field.min === undefined || value.length >= field.min) &&
  (field.max === undefined || value.length <= field.max)

function fits(field: ActionField, value: unknown): boolean {
  switch (field.kind) {
    // `task` is here for the compiler's sake: its options are composed by the window from what
    // has run, so no action declares one.
    case 'text':
    case 'longText':
    case 'choice':
    case 'image':
    case 'mesh':
    case 'task':
      return (
        typeof value === 'string' &&
        (!field.required || value.trim() !== '') &&
        !PLACEHOLDER.test(value) &&
        (!field.options || field.options.includes(value)) &&
        // 🛑 A LENGTH on a text field, and it was applied by nobody: an over-long summary reached
        // the main process, zod threw there, and the client got a refusal naming no field to
        // repair — so it retried the same call. `tools.ts` publishes it as `maxLength`.
        withinLength(field, value)
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

/**
 * The input a handler will read, or `null` when it does not fit the registry.
 *
 * 🛑 A lone value fills a `repeated` field. Measured on the bench pass of 2026-08-25: a model
 * writing `assetIds: "asset-4"` was refused `badInput`, learnt nothing from it, and sent the
 * same call again — 18 refusals in one request, on a value that was right.
 */
export function readInput(
  fields: readonly ActionField[],
  input: Record<string, unknown>,
): Record<string, unknown> | null {
  const listed: Record<string, unknown> = { ...input }
  for (const field of fields) {
    const value = listed[field.key]
    if (field.repeated && value !== undefined && !Array.isArray(value)) listed[field.key] = [value]
  }

  return validatesInput(fields, listed) ? listed : null
}

/** How a field is named back to a caller: its key, and what it takes. */
function wants(field: ActionField): string {
  const kind = field.repeated ? `a list of ${field.kind}` : field.kind
  return field.options ? `${kind}, one of: ${field.options.join(', ')}` : kind
}

/**
 * Why this input was refused, for the caller that has to repair it — `null` when nothing is wrong.
 *
 * 🛑 ONE problem, the first found: a list of five reads as a broken call rather than as a field
 * to fix, and the model then rewrites the whole thing instead of the one value.
 */
export function inputProblem(
  fields: readonly ActionField[],
  input: Record<string, unknown>,
): string | null {
  for (const key of Object.keys(input)) {
    if (!fields.some(field => field.key === key)) {
      return `no field "${key}" — this action takes: ${fields.map(one => one.key).join(', ')}`
    }
  }

  for (const field of fields) {
    const value = input[field.key]
    if (value === undefined) {
      if (field.required) return `"${field.key}" is required — ${wants(field)}`
      continue
    }

    if (isEmpty(value)) return EMPTY_VALUE(field.key)
    if (typeof value === 'string' && PLACEHOLDER.test(value))
      return WROTE_PLACEHOLDER(field.key, value)
    if (field.repeated && !Array.isArray(value)) return `"${field.key}" wants ${wants(field)}`
    const items = field.repeated && Array.isArray(value) ? value : [value]
    if (!items.every(item => fits(field, item))) return `"${field.key}" wants ${wants(field)}`
  }

  return null
}

/** `<the id>`, `$ASSET_ID`, `{{path}}` — a shape a caller writes when it has no value to write. */
const PLACEHOLDER = /^(<.*>|\$[A-Z_]+|\{\{.*\}\}|TODO|xxx+)$/i

/**
 * 🛑 It says LOOK FIRST, because the measured case is a model that had already been answered:
 * `projects.list` returned the one project, and the next call still wrote `<CHEMIN_PROJET>`. Told
 * only to run the call that answers it, the model re-ran the listing or gave up and announced the
 * gesture as done — measured on 41.8, 2026-08-31.
 */
const WROTE_PLACEHOLDER = (key: string, value: string): string =>
  `"${key}" reads ${value}, which is a placeholder and not a value. Nothing here fills one in. ` +
  `Read the answer of a call you have ALREADY made this turn and copy the value from it; only if ` +
  `no answer holds it, run the call that answers it and send this one again.`

const isEmpty = (value: unknown): boolean =>
  value === null || value === '' || (Array.isArray(value) && value.length === 0)

/**
 * 🛑 What an EMPTY value is told, and it says what to do rather than what is wrong: measured on
 * the bench pass of 2026-08-26, 41 calls carried a field the caller had not been answered yet —
 * a search and the call reading its result, sent in one breath.
 */
const EMPTY_VALUE = (key: string): string =>
  `"${key}" was empty — you do not have that value yet. Run the call that answers it, ` +
  `then send this one again on the NEXT round with what came back.`
