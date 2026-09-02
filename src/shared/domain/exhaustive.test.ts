import { describe, expect, it } from 'vitest'
import { LOG_SCOPES, type LogScope } from '../ipc'
import {
  ACTIVITY_LEVELS,
  ACTIVITY_MESSAGES,
  ACTIVITY_TOPICS,
  type ActivityLevel,
  type ActivityMessage,
  type ActivityTopic,
} from './activity'
import { ASSET_BADGES, ASSET_TYPES, type AssetBadge, type AssetType } from './asset'
import { CLOUD_ORDERS, type CloudOrder } from './cloudAsset'
import { SETTINGS_SECTION_IDS, type SettingsSectionId } from './settings'
import { WINDOW_PAGES, type WindowPage } from './window'
import {
  ACTION_COMMITMENTS,
  ACTION_REACHES,
  ACTION_REFUSALS,
  ACTION_REGISTRY,
  ASSISTANT_MODELS,
  type ActionCommitment,
  type ActionName,
  type ActionReach,
  type ActionRefusal,
  type AssistantModel,
} from './assistant'
import {
  MODEL_FAMILIES,
  MODEL_PERIODS,
  MODEL_SORTS,
  type ModelFamily,
  type ModelPeriod,
  type ModelSort,
} from './model'
import { FONT_SOURCES, type FontSource } from './font'
import { PLAY_STATES, type PlayState } from './gameRuntime'
import { TEXTURE_SLOTS, type TextureSlot } from './scene'
import { SETTING_ACTION_IDS, type SettingActionId } from './settingAction'
import { NAMED_KEYS, type NamedKey } from './shortcut'
import { TARGET_KINDS, type TargetKind } from './target'

/**
 * Each of these lists is walked to check something else — the i18n bundles above all, which are
 * verified key by key against them. A value missing from a list is therefore not caught by the
 * check that reads it: the walk simply never reaches it, and the gap reads as coverage.
 *
 * TypeScript cannot say on its own that an array covers its union. A `Record<Union, true>` can:
 * adding a member without listing it here stops compiling. The comparison then ties the list to
 * that record, so neither can drift alone.
 *
 * `job.ts` and `media.ts` keep theirs in their own test files, beside the behaviour they also
 * check. These have no such file to live in.
 */
const sorted = (values: readonly string[]): readonly string[] => [...values].sort()

describe('the lists that stand for a union', () => {
  /**
   * `z.enum(TARGET_KINDS)` decides whether a whole thought parses, so a kind added to the union
   * and forgotten here does not fail on that one target: `parseThought` throws, the window's
   * `.catch` marks the turn lost, and every sentence of the session dies with nothing in the log.
   */
  it('names every kind a sentence can aim at', () => {
    const all: Record<TargetKind, true> = { layer: true, node: true, clip: true, track: true }

    expect(sorted(TARGET_KINDS)).toEqual(sorted(Object.keys(all)))
  })

  /**
   * 🛑 `z.enum(PLAY_STATES)` decides whether the WHOLE studio snapshot parses: a state added to
   * the union and forgotten here makes `parseSnapshot` answer null, and the entire "Studio now:"
   * block leaves every briefing without a word anywhere.
   */
  it('names every state a game can be in', () => {
    const all: Record<PlayState, true> = { edit: true, playing: true, paused: true }

    expect(sorted(PLAY_STATES)).toEqual(sorted(Object.keys(all)))
  })

  /**
   * 🛑 Two doors read this list, and both fail at RUNTIME on a section the union knows and the
   * list forgot: `z.enum(SETTINGS_SECTION_IDS)` refuses `settings.open`, and the MCP action
   * publishes an option it will not accept. `readonly SettingsSectionId[]` accepts a short list,
   * so the compiler says nothing — this was live for the sub-section added on 2026-08-29.
   */
  it('names every section the settings window can open', () => {
    const all: Record<SettingsSectionId, true> = {
      general: true,
      account: true,
      appearance: true,
      generation: true,
      ai: true,
      'ai.image': true,
      'ai.video': true,
      'ai.3d': true,
      'ai.audio': true,
      'ai.material': true,
      'ai.skybox': true,
      'ai.code': true,
      'ai.upscale': true,
      'ai.background-removal': true,
      'ai.vectorization': true,
      spaces: true,
      'spaces.three': true,
      shortcuts: true,
      dictation: true,
      media: true,
      git: true,
      mcp: true,
      memory: true,
      'memory.graph': true,
      storage: true,
      advanced: true,
    }

    expect(sorted(SETTINGS_SECTION_IDS)).toEqual(sorted(Object.keys(all)))
  })

  it('names every asset type', () => {
    const all: Record<AssetType, true> = {
      image: true,
      video: true,
      audio: true,
      mesh: true,
      skybox: true,
      animation: true,
    }

    expect(sorted(ASSET_TYPES)).toEqual(sorted(Object.keys(all)))
  })

  it('names every badge an asset can wear', () => {
    const all: Record<AssetBadge, true> = {
      'local-only': true,
      synced: true,
      'to-push': true,
      'to-pull': true,
      conflict: true,
      error: true,
      'other-account': true,
      'remote-only': true,
      published: true,
      generating: true,
      fetching: true,
      missing: true,
    }

    expect(sorted(ASSET_BADGES)).toEqual(sorted(Object.keys(all)))
  })

  it('names every model family', () => {
    const all: Record<ModelFamily, true> = {
      image: true,
      video: true,
      '3d': true,
      audio: true,
      material: true,
      skybox: true,
      code: true,
      upscale: true,
      'background-removal': true,
      vectorization: true,
      other: true,
    }

    expect(sorted(MODEL_FAMILIES)).toEqual(sorted(Object.keys(all)))
  })

  it('names every period and every order the model list offers', () => {
    const periods: Record<ModelPeriod, true> = { day: true, week: true, month: true, quarter: true }
    const sorts: Record<ModelSort, true> = { relevance: true, recent: true, oldest: true }

    expect(sorted(MODEL_PERIODS)).toEqual(sorted(Object.keys(periods)))
    expect(sorted(MODEL_SORTS)).toEqual(sorted(Object.keys(sorts)))
  })

  // A value the type gains without the list is one the assistant is never offered, and one the
  // validator refuses — a choice that exists in TypeScript and nowhere a caller can reach.
  it('names every order a library search can come back in', () => {
    const orders: Record<CloudOrder, true> = { newest: true, relevance: true }

    expect(sorted(CLOUD_ORDERS)).toEqual(sorted(Object.keys(orders)))
  })

  it('names every level and every topic the journal files a line under', () => {
    const levels: Record<ActivityLevel, true> = { info: true, warn: true, error: true }
    const topics: Record<ActivityTopic, true> = {
      generation: true,
      import: true,
      library: true,
      document: true,
      project: true,
      shell: true,
      assistant: true,
    }

    expect(sorted(ACTIVITY_LEVELS)).toEqual(sorted(Object.keys(levels)))
    expect(sorted(ACTIVITY_TOPICS)).toEqual(sorted(Object.keys(topics)))
  })

  // A name in the union but not in the list leaves `DYNAMIC_KEYS`, and the line ships untranslated.
  it('names every line the main process can write', () => {
    const messages: Record<ActivityMessage, true> = {
      apiRefused: true,
      assistantAnswered: true,
      assistantAsked: true,
      assistantRan: true,
      assistantRefused: true,
      assistantSent: true,
      captionFailed: true,
      captioned: true,
      extractFailed: true,
      extractedNothing: true,
      extractedTextures: true,
      fileAdopted: true,
      fileNotOpened: true,
      filesFound: true,
      filesMissing: true,
      filesRefused: true,
      generated: true,
      generatedInto: true,
      importFailed: true,
      importUnreadable: true,
      imported: true,
      jobCancelled: true,
      jobFailed: true,
      jobWaitsForProject: true,
      projectAccountMissing: true,
      projectAccountRestored: true,
      projectAccountSwitched: true,
      projectHoldsProjects: true,
      projectLegacyAssetsFolder: true,
      projectNameTaken: true,
      projectNameUnsafe: true,
      projectNested: true,
      projectNotAProject: true,
      projectNotCreated: true,
      projectNotRenamed: true,
      projectNotRevealed: true,
      projectNotTrashed: true,
      projectTooNew: true,
      projectTrashed: true,
      projectUnreadable: true,
      pullFailed: true,
      pulled: true,
      pushFailed: true,
      pushed: true,
      tagsNotSynced: true,
      unknownMessage: true,
    }

    expect(sorted(ACTIVITY_MESSAGES)).toEqual(sorted(Object.keys(messages)))
  })

  // The one that already cost a bug: `font.face` shipped without its line and read as its key.
  it('names every scope the renderer can report a failure under', () => {
    const all: Record<LogScope, true> = {
      'scene.model': true,
      'scene.bvh': true,
      'scene.carved': true,
      'scene.texture': true,
      'scene.animation': true,
      'scene.export': true,
      'scene.post': true,
      'scene.render': true,
      'scene.capture': true,
      'sequence.export': true,
      'sequence.import': true,
      'document.export': true,
      'material.map': true,
      'material.channel': true,
      'material.seam': true,
      'material.shader': true,
      'material.export': true,
      'skybox.source': true,
      'skybox.probes': true,
      'skybox.export': true,
      'canvas.layer': true,
      'canvas.place': true,
      'code.land': true,
      'canvas.size': true,
      'canvas.edit': true,
      'image.export': true,
      'document.load': true,
      'document.save': true,
      'document.close': true,
      'document.delete': true,
      'assets.reveal': true,
      'assets.open': true,
      'assets.save': true,
      'assets.copy': true,
      'assets.contactSheet': true,
      'assets.extract': true,
      'assets.rename': true,
      'assets.retype': true,
      'document.rename': true,
      'project.reveal': true,
      'project.forget': true,
      'project.close': true,
      'project.rename': true,
      'font.face': true,
      'shell.render': true,
      'shell.layout': true,
      'shell.menu': true,
      'sequence.mirror': true,
      'explorer.open': true,
    }

    expect(sorted(LOG_SCOPES)).toEqual(sorted(Object.keys(all)))
  })

  it('names every key that is a word rather than a glyph', () => {
    const all: Record<NamedKey, true> = {
      Space: true,
      Enter: true,
      Escape: true,
      Delete: true,
      Backspace: true,
      Tab: true,
      Home: true,
      End: true,
      PageUp: true,
      PageDown: true,
    }

    expect(sorted(NAMED_KEYS)).toEqual(sorted(Object.keys(all)))
  })

  /**
   * The ids were derived from the registry until `settingAction.ts` had to leave it — the action
   * catalogue closes a field over them and cannot pull every setting's help text into the opening
   * chunk with it. A hand-written list standing for a union is exactly what this file is for.
   */
  it('names every button the settings window offers', () => {
    const all: Record<SettingActionId, true> = {
      'advanced.openSettingsFile': true,
      'advanced.openLogFolder': true,
      'advanced.openDevtools': true,
      'mcp.copyCommand': true,
      'mcp.copyConfig': true,
      'advanced.installResolveBridge': true,
      'advanced.reset': true,
    }

    expect(sorted(SETTING_ACTION_IDS)).toEqual(sorted(Object.keys(all)))
  })

  // Read by `layer.editTextLayer`, which offers the two as a choice: a third source no list named would be
  // a face a client could not ask for.
  it('names every place a typeface comes from', () => {
    const all: Record<FontSource, true> = { embedded: true, system: true }

    expect(sorted(FONT_SOURCES)).toEqual(sorted(Object.keys(all)))
  })

  it('names every texture slot a material carries', () => {
    const all: Record<TextureSlot, true> = {
      map: true,
      normalMap: true,
      roughnessMap: true,
      metalnessMap: true,
      aoMap: true,
      emissiveMap: true,
      displacementMap: true,
    }

    expect(sorted(TEXTURE_SLOTS)).toEqual(sorted(Object.keys(all)))
  })

  /**
   * The assistant's three, and they carry a sharper cost than the rest: `ACTION_REFUSALS` and
   * `ASSISTANT_MODELS` are each handed to a `z.enum` at an IPC boundary. A value missing from a
   * list is then a legitimate answer REJECTED at the frontier — and the walk that checks the
   * bundles never reaches it either, so the gap reads as coverage twice over.
   */
  it('names every reason an action can be refused', () => {
    const all: Record<ActionRefusal, true> = {
      unknownCommand: true,
      wrongSurface: true,
      generatorClosed: true,
      ambiguousLanding: true,
      nothingPrepared: true,
      notSubmitted: true,
      badInput: true,
      noBridge: true,
      noProject: true,
      noConfirmer: true,
      declined: true,
      noWindow: true,
      timedOut: true,
      noReference: true,
      formChanged: true,
      notFound: true,
      notAllowed: true,
      nativeDialog: true,
      notRenderable: true,
      needsConsent: true,
      failed: true,
    }

    expect(sorted(ACTION_REFUSALS)).toEqual(sorted(Object.keys(all)))
  })

  it('names every model the assistant may think with', () => {
    const all: Record<AssistantModel, true> = {
      'claude-haiku-4-5': true,
      'claude-sonnet-4-6': true,
      'claude-opus-4-8': true,
      'gemini-3.5-flash': true,
    }

    expect(sorted(ASSISTANT_MODELS)).toEqual(sorted(Object.keys(all)))
  })

  it('names every level of commitment an action can carry', () => {
    const all: Record<ActionCommitment, true> = {
      none: true,
      studio: true,
      files: true,
      asset: true,
      remote: true,
      credits: true,
    }

    expect(sorted(ACTION_COMMITMENTS)).toEqual(sorted(Object.keys(all)))
  })

  /**
   * 🛑 `WINDOW_PAGES` is the `options` list of `help.openStudioWindow`, so a page added to the union and
   * forgotten here compiles, is never published on the MCP wire, and nothing says so — the
   * `Record<WindowPage, …>` in `help.ts` only catches an opener that is missing.
   */
  it('names every window a renderer may raise', () => {
    const all: Record<WindowPage, true> = {
      manual: true,
      licences: true,
      usage: true,
      journal: true,
    }

    expect(sorted(WINDOW_PAGES)).toEqual(sorted(Object.keys(all)))
  })

  /**
   * The one union of this family that had no entry here, and the omission had teeth: publishing
   * the whole registry was `actionsReaching`'s fallback, so a third reach would have gone out on
   * the MCP wire by default. What holds the wire now is the `switch` there, which the COMPILER
   * tends; this list — like `ACTION_COMMITMENTS` above it — only keeps the constant in step.
   */
  it('names every door the registry reaches', () => {
    const all: Record<ActionReach, true> = {
      both: true,
      mcp: true,
    }

    expect(sorted(ACTION_REACHES)).toEqual(sorted(Object.keys(all)))
  })

  /**
   * The one direction nothing else holds. The compiler ties each family table to `ActionName`,
   * and `executor.test.ts` ties the handlers to the registry — so a name added to the union and
   * never built leaves BOTH of those green while the studio publishes nothing for it.
   *
   * `Record` rather than a list, for the reason every case above uses one: the compiler makes
   * the table exhaustive, and the assertion makes the registry match it.
   */
  it('builds every action the union declares', () => {
    const all: Record<ActionName, true> = {
      'command.runStudioCommand': true,
      'workspace.open': true,
      'models.search': true,
      'models.select': true,
      'generator.prepare': true,
      'generator.readArmedGeneration': true,
      'generator.submit': true,
      'jobs.list': true,
      'prompt.suggest': true,
      'prompt.translate': true,
      'prompt.describeStyle': true,
      'chat.close': true,
      'actions.find': true,
      'target.select': true,
      'studio.state': true,
      'documents.list': true,
      'document.open': true,
      'document.activate': true,
      'document.close': true,
      'document.rename': true,
      'document.save': true,
      'document.deleteFromDisk': true,
      'document.export': true,
      'activity.recent': true,
      'projects.list': true,
      'project.open': true,
      'project.close': true,
      'project.create': true,
      'project.forget': true,
      'project.trash': true,
      'file.open': true,
      'files.list': true,
      'files.search': true,
      'files.move': true,
      'files.copy': true,
      'files.duplicate': true,
      'files.trash': true,
      'files.undoFileOperation': true,
      'files.redoFileOperation': true,
      'files.canUndoRedoFiles': true,
      'file.rename': true,
      'file.facts': true,
      'file.reveal': true,
      'folder.new': true,
      'project.rename': true,
      'models.readGenerationModelFields': true,
      'cost.estimate': true,
      'job.readCloudGeneration': true,
      'job.waitForCloudGeneration': true,
      'job.cancelCloudGeneration': true,
      'task.cancelLocalTask': true,
      'usage.report': true,
      'assets.searchProjectCatalogue': true,
      'assets.counts': true,
      'assets.listMissingProjectAssets': true,
      'assets.captionImages': true,
      'asset.get': true,
      'asset.update': true,
      'asset.reveal': true,
      'asset.extractTextures': true,
      'assets.removeFromLibrary': true,
      'canvas.state': true,
      'canvas.resize': true,
      'canvas.setPixelArt': true,
      'canvas.drawPixels': true,
      'canvas.crop': true,
      'canvas.flipOrRotate': true,
      'layer.add': true,
      'layer.remove': true,
      'layer.select': true,
      'layer.rename': true,
      'layer.setOpacityBlendAndVisibility': true,
      'layer.transform': true,
      'layer.editTextLayer': true,
      'layer.reorderInStack': true,
      'layer.duplicate': true,
      'layer.group': true,
      'layer.ungroup': true,
      'layer.mergeDown': true,
      'layer.lock': true,
      'layer.editShapeLayer': true,
      'layer.setAdjustmentAmount': true,
      'layer.setMaskOptions': true,
      'guide.add': true,
      'guide.move': true,
      'guide.remove': true,
      'sequence.state': true,
      'sequence.seek': true,
      'clip.add': true,
      'clip.remove': true,
      'clip.move': true,
      'clip.trim': true,
      'clip.split': true,
      'clip.fade': true,
      'clip.gain': true,
      'clip.speed': true,
      'clip.unlink': true,
      'clip.select': true,
      'track.add': true,
      'track.remove': true,
      'track.reorderTracks': true,
      'track.rename': true,
      'track.setMuteSoloLockHeight': true,
      'skybox.state': true,
      'skybox.setViewportOptions': true,
      'skybox.adjustImage': true,
      'skybox.resetAdjustments': true,
      'skybox.setSun': true,
      'skybox.setPreviewLighting': true,
      'skybox.setSourceImage': true,
      'material.state': true,
      'material.setSurfaceSettings': true,
      'material.setPreviewEnvironment': true,
      'material.setPreviewDisplay': true,
      'material.setChannelImage': true,
      'styles.list': true,
      'style.save': true,
      'style.rename': true,
      'style.remove': true,
      'cloud.browseAccountLibrary': true,
      'cloud.explorePublicFeed': true,
      'cloud.findSimilarPublished': true,
      'cloud.previewSync': true,
      'cloud.pull': true,
      'cloud.push': true,
      'auth.state': true,
      'window.state': true,
      'window.fullScreen': true,
      'settings.open': true,
      'updates.state': true,
      'updates.install': true,
      'dictation.state': true,
      'dictation.start': true,
      'dictation.stop': true,
      'panels.list': true,
      'panel.open': true,
      'panel.close': true,
      'media.capabilities': true,
      'media.indexFileInPlace': true,
      'fonts.list': true,
      'favorites.listPinnedRecipes': true,
      'favorite.pinAssetRecipe': true,
      'favorite.unpinAssetRecipe': true,
      'fileInfo.openWindow': true,
      'mirror.openVideoReturnWindow': true,
      'help.openStudioWindow': true,
      'scene.state': true,
      'node.add': true,
      'node.addModel': true,
      'node.markAsCuttingTool': true,
      'node.combineIntoSolid': true,
      'node.swapSolidMatterAndTool': true,
      'node.separate': true,
      'node.remove': true,
      'node.attach': true,
      'node.rename': true,
      'node.transform': true,
      'node.setVisible': true,
      'node.setMeshMaterial': true,
      'node.setPrimitiveParameters': true,
      'node.setShadowCastAndReceive': true,
      'node.setSpriteSettings': true,
      'node.setTextSettings': true,
      'node.setPathShape': true,
      'path.addPoint': true,
      'path.movePoint': true,
      'path.removePoint': true,
      'model.setMaterialDocument': true,
      'model.setBaseColorImage': true,
      'node.setLightSettings': true,
      'node.setCameraLens': true,
      'camera.addShot': true,
      'camera.bindPathToShot': true,
      'camera.createAndBindPath': true,
      'camera.aimShotAt': true,
      'camera.reorder': true,
      'node.reparent': true,
      'node.select': true,
      'view.direction': true,
      'view.setDisplayMode': true,
      'scene.capture': true,
      'world.applyPreset': true,
      'world.setSceneLighting': true,
      'world.setBackground': true,
      'world.setFog': true,
      'world.setGroundPlane': true,
      'world.setToneMapping': true,
      'post.state': true,
      'post.add': true,
      'post.remove': true,
      'post.move': true,
      'post.set': true,
      'post.setEffectEnabled': true,
      'post.setWholeStackEnabled': true,
      'post.applyPreset': true,
      'post.listPresets': true,
      'post.duplicate': true,
      'post.reset': true,
      'post.addEffectKeyframe': true,
      'post.removeEffectKeyframe': true,
      'post.savePreset': true,
      'post.renamePreset': true,
      'post.deleteSavedPreset': true,
      'post.setCameraStackMode': true,
      'rig.state': true,
      'rig.fit': true,
      'rig.clear': true,
      'rig.configureHands': true,
      'socket.add': true,
      'socket.remove': true,
      'bone.add': true,
      'bone.remove': true,
      'bone.rename': true,
      'bone.setRole': true,
      'ik.add': true,
      'ik.remove': true,
      'animations.list': true,
      'animation.addBlock': true,
      'animation.removeBlock': true,
      'animation.setBlockSettings': true,
      'animation.setBandLengthAndRate': true,
      'animation.autoKey': true,
      'key.writePoseKeys': true,
      'key.removeSubjectKeys': true,
      'key.writeKeysOnOpenChannels': true,
      'key.move': true,
      'channel.remove': true,
      'channel.setMuteSoloLock': true,
      'git.status': true,
      'git.log': true,
      'git.listCommitFiles': true,
      'git.diff': true,
      'git.branches': true,
      'git.stashes': true,
      'git.init': true,
      'git.stage': true,
      'git.unstage': true,
      'git.restore': true,
      'git.commit': true,
      'git.createBranch': true,
      'git.checkout': true,
      'git.stash': true,
      'git.stashPop': true,
      'git.tag': true,
      'git.stashDrop': true,
      'git.resolve': true,
      'git.abortMerge': true,
      'git.remotes': true,
      'git.addRemote': true,
      'git.fetch': true,
      'git.pull': true,
      'git.push': true,
      'component.attach': true,
      'component.detach': true,
      'component.setProperties': true,
      'play.start': true,
      'play.stop': true,
      'play.pause': true,
      'play.resume': true,
      'play.step': true,
      'play.loadScene': true,
      'runtime.report': true,
      'runtime.errors': true,
      'script.list': true,
      'script.read': true,
      'script.write': true,
      'studio.describe': true,
      'studio.docs': true,
      'studio.batch': true,
      'timeline.addSceneCue': true,
      'timeline.removeSceneCue': true,
      'timeline.setPanelRows': true,
      'game.applyTemplate': true,
      'prefab.define': true,
      'prefab.instantiate': true,
      'game.export': true,
      'memory.recall': true,
      'memory.read': true,
      'memory.write': true,
      'memory.forget': true,
      'memory.link': true,
      'context.readProjectCards': true,
      'context.writeProjectCard': true,
      'context.deleteProjectCard': true,
      'settings.read': true,
      'settings.write': true,
      'settings.triggerSettingAction': true,
      'accounts.list': true,
      'accounts.activate': true,
      'accounts.rename': true,
    }

    expect(sorted(ACTION_REGISTRY.map(entry => entry.name))).toEqual(sorted(Object.keys(all)))
  })
})
