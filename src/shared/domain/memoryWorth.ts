import { readString } from '../guards'
import type { ActionName } from './assistantAction'
import type { MemoryRefKind, MemoryType } from './assistantMemory'

/**
 * What each action leaves behind, if anything. `null` for almost all of them, and that is the
 * shape of the table rather than a gap: moving a node, searching assets or writing a setting are
 * gestures, not things learned.
 *
 * 🛑 `Record<ActionName, …>` on purpose, exactly like `COVERAGE` in `scripts/banc/coverage.ts`:
 * an action added to the registry does not COMPILE until this file has answered « what, if
 * anything, is worth remembering about it » — even if the answer is `null`, which is then a hole
 * declared rather than one forgotten.
 */

/**
 * What a rule draws, before the window turns it into a memory.
 *
 * A KEY and not a sentence: the summary is shown to the person in Réglages ▸ Mémoire, so it is a
 * word of the interface and cannot be written here — the window resolves it in their language,
 * exactly as every tooltip factory receives text already translated.
 */
export type MemoryDrawn = {
  type: MemoryType
  summaryKey: string
  /** What fills the holes of the key. Values, never sentences — a path, a name, a message. */
  values: Readonly<Record<string, string>>
  importance: number
  refs?: readonly { kind: MemoryRefKind; ref: string }[]
}

/**
 * `reads` beside the function so a guard can check it: a rule naming a field the action does not
 * declare reads `undefined` for ever, and nothing else in the studio would say so.
 */
export type MemoryRule = null | {
  readonly reads: readonly string[]
  readonly draft: (input: Record<string, unknown>, data: unknown) => MemoryDrawn | null
}

/** A field the input holds as words, or nothing. `readString` answers '' for anything else. */
const textOf = (input: Record<string, unknown>, key: string): string | null =>
  readString(input, key, '').trim() === '' ? null : readString(input, key, '')

/** The shape three of the six rules share: one named thing, remembered under its name. */
const named = (
  input: Record<string, unknown>,
  type: MemoryType,
  summaryKey: string,
  importance: number,
): MemoryDrawn | null => {
  const name = textOf(input, 'name')
  return name === null ? null : { type, summaryKey, values: { name }, importance }
}

export const MEMORY_WORTH: Record<ActionName, MemoryRule> = {
  'command.run': null,
  'workspace.open': null,
  'models.search': null,
  'models.select': null,
  'generator.prepare': null,
  'generator.submit': null,
  'jobs.list': null,
  'prompt.suggest': null,
  'prompt.translate': null,
  'prompt.describeStyle': null,
  'chat.close': null,
  'actions.find': null,
  'target.select': null,
  'studio.state': null,
  'documents.list': null,
  'document.open': null,
  'document.activate': null,
  'document.close': null,
  'document.rename': null,
  'document.save': null,
  'document.remove': null,
  'document.export': null,
  'activity.recent': null,
  'project.open': null,
  'project.close': null,
  'project.create': null,
  'file.open': null,
  'files.list': null,
  'files.search': null,
  'files.move': null,
  'files.copy': null,
  'files.duplicate': null,
  'files.trash': null,
  'files.undo': null,
  'files.redo': null,
  'files.history': null,
  'file.rename': null,
  'file.facts': null,
  'file.reveal': null,
  'folder.new': null,
  'project.rename': null,
  'model.schema': null,
  'cost.estimate': null,
  'job.get': null,
  'job.wait': null,
  'job.cancel': null,
  'task.cancel': null,
  'usage.report': null,
  'assets.search': null,
  'assets.counts': null,
  'assets.absent': null,
  'assets.describe': null,
  'asset.get': null,
  'asset.update': null,
  'asset.reveal': null,
  'asset.extractTextures': null,
  'assets.remove': null,
  'canvas.state': null,
  'canvas.resize': null,
  'canvas.crop': null,
  'canvas.orient': null,
  'layer.add': null,
  'layer.remove': null,
  'layer.select': null,
  'layer.rename': null,
  'layer.style': null,
  'layer.transform': null,
  'layer.text': null,
  'layer.move': null,
  'layer.duplicate': null,
  'layer.group': null,
  'layer.ungroup': null,
  'layer.mergeDown': null,
  'layer.lock': null,
  'layer.shape': null,
  'layer.adjustment': null,
  'layer.mask': null,
  'guide.add': null,
  'guide.move': null,
  'guide.remove': null,
  'sequence.state': null,
  'sequence.seek': null,
  'clip.add': null,
  'clip.remove': null,
  'clip.move': null,
  'clip.trim': null,
  'clip.split': null,
  'clip.fade': null,
  'clip.gain': null,
  'clip.speed': null,
  'clip.unlink': null,
  'clip.select': null,
  'track.add': null,
  'track.remove': null,
  'track.move': null,
  'track.rename': null,
  'track.adjust': null,
  'skybox.state': null,
  'skybox.view': null,
  'skybox.adjust': null,
  'skybox.resetAdjustments': null,
  'skybox.sun': null,
  'skybox.environment': null,
  'skybox.source': null,
  'material.state': null,
  'material.material': null,
  'material.environment': null,
  'material.preview': null,
  'material.channel': null,
  'styles.list': null,
  'style.save': {
    reads: ['name'],
    draft: input => named(input, 'convention', 'memoryWorth.styleSave', 2),
  },
  'style.rename': null,
  'style.remove': null,
  'cloud.browse': null,
  'cloud.explore': null,
  'cloud.similar': null,
  'cloud.plan': null,
  'cloud.pull': null,
  'cloud.push': null,
  'auth.state': null,
  'window.state': null,
  'window.fullScreen': null,
  'settings.open': null,
  'updates.state': null,
  'updates.install': null,
  'dictation.state': null,
  'dictation.start': null,
  'dictation.stop': null,
  'panels.list': null,
  'panel.open': null,
  'panel.close': null,
  'media.capabilities': null,
  'media.adopt': null,
  'fonts.list': null,
  'favorites.list': null,
  'favorite.pin': null,
  'favorite.unpin': null,
  'fileInfo.open': null,
  'mirror.open': null,
  'help.open': null,
  'scene.state': null,
  'node.add': null,
  'node.addModel': null,
  'node.negate': null,
  'node.carve': null,
  'node.carveInvert': null,
  'node.separate': null,
  'node.remove': null,
  'node.rename': null,
  'node.transform': null,
  'node.visible': null,
  'node.material': null,
  'node.geometry': null,
  'node.shadow': null,
  'node.sprite': null,
  'node.text': null,
  'node.path': null,
  'path.addPoint': null,
  'path.movePoint': null,
  'path.removePoint': null,
  'node.light': null,
  'node.camera': null,
  'model.wearMaterial': null,
  'model.wearImage': null,
  'camera.shot': null,
  'camera.rail': null,
  'camera.addRail': null,
  'camera.target': null,
  'camera.reorder': null,
  'node.reparent': null,
  'node.select': null,
  'view.direction': null,
  'view.display': null,
  'scene.capture': null,
  'world.preset': null,
  'world.environment': null,
  'world.background': null,
  'world.fog': null,
  'world.ground': null,
  'world.render': null,
  'post.state': null,
  'post.add': null,
  'post.remove': null,
  'post.move': null,
  'post.set': null,
  'post.enable': null,
  'post.switch': null,
  'post.preset': null,
  'post.presets': null,
  'post.duplicate': null,
  'post.reset': null,
  'post.key': null,
  'post.unkey': null,
  'post.save': {
    reads: ['name'],
    draft: input => named(input, 'convention', 'memoryWorth.postSave', 2),
  },
  'post.rename': null,
  'post.forget': null,
  'post.camera': null,
  'rig.state': null,
  'rig.fit': null,
  'rig.clear': null,
  'rig.hands': null,
  'bone.add': null,
  'bone.remove': null,
  'bone.rename': null,
  'bone.role': null,
  'ik.add': null,
  'ik.remove': null,
  'animations.list': null,
  'animation.add': {
    reads: ['clipName'],
    draft: input => {
      const name = textOf(input, 'clipName')
      return name === null
        ? null
        : {
            type: 'entity',
            summaryKey: 'memoryWorth.animationAdd',
            values: { name },
            importance: 2,
          }
    },
  },
  'animation.remove': null,
  'animation.block': null,
  'animation.settings': null,
  'animation.autoKey': null,
  'key.pose': null,
  'key.clear': null,
  'key.all': null,
  'key.move': null,
  'channel.remove': null,
  'channel.flags': null,
  'git.status': null,
  'git.log': null,
  'git.commitFiles': null,
  'git.diff': null,
  'git.branches': null,
  'git.stashes': null,
  'git.init': null,
  'git.stage': null,
  'git.unstage': null,
  'git.restore': null,
  'git.commit': {
    reads: ['message'],
    draft: input => {
      const message = textOf(input, 'message')
      return message === null
        ? null
        : {
            type: 'decision',
            summaryKey: 'memoryWorth.gitCommit',
            values: { message },
            importance: 3,
          }
    },
  },
  'git.createBranch': null,
  'git.checkout': null,
  'git.stash': null,
  'git.stashPop': null,
  'git.tag': null,
  'git.stashDrop': null,
  'git.resolve': null,
  'git.abortMerge': null,
  'git.remotes': null,
  'git.addRemote': null,
  'git.fetch': null,
  'git.pull': null,
  'git.push': null,
  'component.attach': null,
  'component.detach': null,
  'component.set': null,
  'play.start': null,
  'play.stop': null,
  'play.pause': null,
  'play.resume': null,
  'play.step': null,
  'play.loadScene': null,
  'runtime.report': null,
  'runtime.errors': null,
  'script.list': null,
  'script.read': null,
  'script.write': {
    reads: ['path'],
    draft: input => {
      const path = textOf(input, 'path')
      return path === null
        ? null
        : {
            type: 'script',
            summaryKey: 'memoryWorth.scriptWrite',
            values: { path },
            importance: 4,
            refs: [{ kind: 'file', ref: path }],
          }
    },
  },
  'studio.describe': null,
  'studio.docs': null,
  'studio.batch': null,
  'timeline.cue': null,
  'timeline.remove': null,
  'timeline.template': null,
  'game.template': null,
  'prefab.define': {
    reads: ['name'],
    draft: input => named(input, 'entity', 'memoryWorth.prefabDefine', 3),
  },
  'prefab.instantiate': null,
  'game.export': null,
  'context.read': null,
  'context.write': null,
  'context.remove': null,
  'settings.read': null,
  'settings.write': null,
  'settings.action': null,
  'accounts.list': null,
  'accounts.activate': null,
  'accounts.rename': null,
}
