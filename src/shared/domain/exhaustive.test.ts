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
import {
  ACTION_COMMITMENTS,
  ACTION_REFUSALS,
  ACTION_REGISTRY,
  ASSISTANT_MODELS,
  type ActionCommitment,
  type ActionName,
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
import { TEXTURE_SLOTS, type TextureSlot } from './scene'
import { NAMED_KEYS, type NamedKey } from './shortcut'

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
  it('names every asset type', () => {
    const all: Record<AssetType, true> = {
      image: true,
      video: true,
      audio: true,
      mesh: true,
      texture: true,
      skybox: true,
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
      texture: true,
      skybox: true,
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

  it('names every level and every topic the journal files a line under', () => {
    const levels: Record<ActivityLevel, true> = { info: true, warn: true, error: true }
    const topics: Record<ActivityTopic, true> = {
      generation: true,
      import: true,
      library: true,
      document: true,
      project: true,
      shell: true,
    }

    expect(sorted(ACTIVITY_LEVELS)).toEqual(sorted(Object.keys(levels)))
    expect(sorted(ACTIVITY_TOPICS)).toEqual(sorted(Object.keys(topics)))
  })

  // A name in the union but not in the list leaves `DYNAMIC_KEYS`, and the line ships untranslated.
  it('names every line the main process can write', () => {
    const messages: Record<ActivityMessage, true> = {
      apiRefused: true,
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
      projectAccountMissing: true,
      projectAccountRestored: true,
      projectAccountSwitched: true,
      projectHoldsProjects: true,
      projectLegacyAssetsFolder: true,
      projectNested: true,
      projectNotAProject: true,
      projectNotCreated: true,
      projectNotRenamed: true,
      projectNotRevealed: true,
      projectTooNew: true,
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
      'scene.texture': true,
      'scene.export': true,
      'scene.render': true,
      'sequence.export': true,
      'texture.map': true,
      'texture.channel': true,
      'texture.seam': true,
      'texture.shader': true,
      'texture.export': true,
      'skybox.source': true,
      'skybox.export': true,
      'canvas.layer': true,
      'canvas.size': true,
      'image.export': true,
      'document.load': true,
      'document.save': true,
      'document.close': true,
      'document.delete': true,
      'assets.reveal': true,
      'assets.open': true,
      'assets.save': true,
      'assets.copy': true,
      'assets.extract': true,
      'assets.rename': true,
      'assets.retype': true,
      'document.rename': true,
      'project.reveal': true,
      'project.forget': true,
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

  it('names every texture slot a material carries', () => {
    const all: Record<TextureSlot, true> = {
      map: true,
      normalMap: true,
      roughnessMap: true,
      metalnessMap: true,
      aoMap: true,
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
      globalCommand: true,
      wrongSurface: true,
      generatorClosed: true,
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
      files: true,
      asset: true,
      remote: true,
      credits: true,
    }

    expect(sorted(ACTION_COMMITMENTS)).toEqual(sorted(Object.keys(all)))
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
      'command.run': true,
      'workspace.open': true,
      'models.search': true,
      'models.select': true,
      'generator.prepare': true,
      'generator.submit': true,
      'jobs.list': true,
      'prompt.suggest': true,
      'prompt.translate': true,
      'prompt.describeStyle': true,
      'chat.close': true,
      'studio.state': true,
      'documents.list': true,
      'document.open': true,
      'document.activate': true,
      'document.close': true,
      'document.rename': true,
      'activity.recent': true,
      'project.open': true,
      'project.create': true,
      'files.list': true,
      'files.search': true,
      'files.move': true,
      'files.copy': true,
      'files.duplicate': true,
      'files.trash': true,
      'file.rename': true,
      'file.facts': true,
      'folder.new': true,
      'model.schema': true,
      'cost.estimate': true,
      'job.get': true,
      'job.wait': true,
      'job.cancel': true,
      'usage.report': true,
      'assets.search': true,
      'assets.counts': true,
      'asset.get': true,
      'asset.update': true,
      'assets.remove': true,
      'canvas.state': true,
      'canvas.resize': true,
      'canvas.crop': true,
      'canvas.orient': true,
      'layer.add': true,
      'layer.remove': true,
      'layer.select': true,
      'layer.rename': true,
      'layer.style': true,
      'layer.transform': true,
      'layer.text': true,
      'layer.move': true,
      'layer.duplicate': true,
      'layer.group': true,
      'layer.ungroup': true,
      'layer.mergeDown': true,
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
      'track.move': true,
      'track.rename': true,
      'track.state': true,
      'skybox.state': true,
      'skybox.adjust': true,
      'skybox.resetAdjustments': true,
      'skybox.sun': true,
      'skybox.environment': true,
      'skybox.source': true,
      'texture.state': true,
      'texture.material': true,
      'texture.preview': true,
      'texture.channel': true,
      'styles.list': true,
      'style.save': true,
      'style.rename': true,
      'style.remove': true,
      'cloud.browse': true,
      'cloud.explore': true,
      'cloud.similar': true,
      'cloud.plan': true,
      'cloud.pull': true,
      'cloud.push': true,
      'auth.state': true,
      'window.state': true,
      'window.fullScreen': true,
      'settings.open': true,
      'updates.state': true,
      'media.capabilities': true,
      'media.adopt': true,
      'fonts.list': true,
      'favorites.list': true,
      'favorite.pin': true,
      'favorite.unpin': true,
      'fileInfo.open': true,
      'mirror.open': true,
      'scene.state': true,
      'node.add': true,
      'node.addModel': true,
      'node.remove': true,
      'node.rename': true,
      'node.transform': true,
      'node.visible': true,
      'node.material': true,
      'node.light': true,
      'node.reparent': true,
      'node.select': true,
      'git.status': true,
      'git.log': true,
      'git.commitFiles': true,
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
      'settings.read': true,
      'settings.write': true,
      'accounts.list': true,
      'accounts.activate': true,
    }

    expect(sorted(ACTION_REGISTRY.map(entry => entry.name))).toEqual(sorted(Object.keys(all)))
  })
})
