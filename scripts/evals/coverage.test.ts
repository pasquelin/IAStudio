import { readFileSync, readdirSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { actionsReaching, type ActionName } from '@shared/domain/assistant'
import { COVERAGE, rankOf, uncoveredActions } from './coverage'
import { SCENARIOS } from './scenarios'

/**
 * 🛑 The registry publishes every one of its actions as an MCP tool, so a tool the batterie
 * never reaches is a tool nobody has seen work. This holds the two lists against each other.
 *
 * The `Record<ActionName, …>` of `coverage.ts` already stops an action being ADDED without an
 * answer; what is left to a test is the other three ways the table lies: a rank that names no
 * scenario, an action declared covered that the fake studio cannot even play, and the roll of
 * what is still measured by nothing — written out rather than counted, because a count is green
 * the day one hole is filled and another is dug.
 */

/**
 * Actions no request of the batterie exercises yet, named one by one.
 *
 * 🛑 Not a number: a count stays green through an exchange, and the exchange is exactly what
 * happens when a family is modelled while a new one is published. This list only shrinks.
 *
 * The price, assumed: the empty lists of `coverage.ts` say the same thing, so covering a family
 * means striking it from two places. What the second one buys is a RED gate on an action added
 * with `[]` — a hole a reader would otherwise have to notice in a diff.
 */
const AWAITING: readonly ActionName[] = [
  'command.run',
  'prompt.suggest',
  'prompt.translate',
  'prompt.describeStyle',
  'actions.find',
  'document.remove',
  'document.export',
  'project.open',
  'project.create',
  'file.reveal',
  'job.cancel',
  'task.cancel',
  'assets.absent',
  'assets.describe',
  'asset.reveal',
  'canvas.crop',
  'canvas.orient',
  'layer.group',
  'layer.ungroup',
  'layer.mergeDown',
  'layer.shape',
  'layer.adjustment',
  'layer.mask',
  'guide.add',
  'guide.move',
  'guide.remove',
  'clip.unlink',
  'track.move',
  'styles.list',
  'style.save',
  'style.rename',
  'style.remove',
  'cloud.browse',
  'cloud.explore',
  'cloud.similar',
  'cloud.plan',
  'cloud.pull',
  'cloud.push',
  'window.state',
  'window.fullScreen',
  'settings.open',
  'updates.state',
  'updates.install',
  'dictation.state',
  'dictation.start',
  'dictation.stop',
  'panels.list',
  'panel.open',
  'panel.close',
  'media.capabilities',
  'media.adopt',
  'fonts.list',
  'favorites.list',
  'favorite.pin',
  'favorite.unpin',
  'fileInfo.open',
  'mirror.open',
  'help.open',
  'node.text',
  'node.path',
  'path.addPoint',
  'path.movePoint',
  'path.removePoint',
  'camera.reorder',
  'view.direction',
  'scene.capture',
  'rig.state',
  'rig.fit',
  'rig.clear',
  'rig.hands',
  'bone.add',
  'bone.remove',
  'bone.rename',
  'bone.role',
  'ik.add',
  'ik.remove',
  'animation.block',
  'animation.autoKey',
  'key.all',
  'key.move',
  'channel.flags',
  'git.status',
  'git.log',
  'git.commitFiles',
  'git.diff',
  'git.branches',
  'git.stashes',
  'git.init',
  'git.stage',
  'git.unstage',
  'git.restore',
  'git.commit',
  'git.createBranch',
  'git.checkout',
  'git.stash',
  'git.stashPop',
  'git.tag',
  'git.stashDrop',
  'git.resolve',
  'git.abortMerge',
  'git.remotes',
  'git.addRemote',
  'git.fetch',
  'git.pull',
  'git.push',
  'context.read',
  'context.write',
  'context.remove',
  'settings.action',
  'accounts.list',
  'accounts.activate',
  'accounts.rename',
]

/**
 * What the fake studio can play, read off the `case` labels of its modules.
 *
 * 🛑 Its blind spot, in clear: this reads the TEXT of those files, so an action dispatched any
 * other way than by a `case` of its own is invisible here and would be reported as unmodelled.
 * Every fake dispatches by `case` today; the day one does not, this is what has to change.
 */
const modelled = (): ReadonlySet<string> => {
  const dir = 'scripts/evals'
  const names = new Set<string>()
  for (const file of readdirSync(dir).filter(one => /^fake.*\.ts$/.test(one))) {
    if (file.includes('.test.')) continue

    const source = readFileSync(`${dir}/${file}`, 'utf8')
    for (const found of source.matchAll(/case '([a-zA-Z]+\.[a-zA-Z]+)':/g))
      names.add(found[1] ?? '')
  }

  return names
}

describe('the MCP surface and the batterie', () => {
  it('names every action the MCP server publishes', () => {
    const published = actionsReaching('mcp').map(one => one.name)
    const named = Object.keys(COVERAGE)

    expect([...named].sort()).toEqual([...published].sort())
  })

  it('cites only ranks the batterie actually carries', () => {
    const ranks = new Set(SCENARIOS.map(one => rankOf(one.name)))
    const ghosts = Object.entries(COVERAGE).flatMap(([action, cited]) =>
      cited.filter(rank => !ranks.has(rank)).map(rank => `${action} → ${rank}`),
    )

    expect(ghosts).toEqual([])
  })

  /**
   * 🛑 An action the fake studio has no answer for is scored BLIND: the bench reports it under
   * « not modelled » and the scenario passes or fails on something else entirely. Declaring one
   * covered is the one way this table can be worse than empty.
   */
  it('declares covered only what the fake studio can play', () => {
    const plays = modelled()
    const blind = Object.entries(COVERAGE)
      .filter(([action, cited]) => cited.length > 0 && !plays.has(action))
      .map(([action]) => action)

    expect(blind).toEqual([])
  })

  // Sorted on both sides: the table reads in registry order, which is worth keeping, and a
  // reordering there is not a coverage change.
  it('leaves exactly these actions measured by nothing', () => {
    expect([...uncoveredActions()].sort()).toEqual([...AWAITING].sort())
  })
})
