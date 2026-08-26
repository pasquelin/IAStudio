import { describe, expect, it } from 'vitest'
import {
  emptyGame,
  scriptPathOf,
  withScriptForgotten,
  withScriptMoved,
  type GameManifest,
} from './game'

const withScripts = (): GameManifest => ({
  ...emptyGame(),
  scripts: [
    { id: 'one', path: 'scripts/player.ts' },
    { id: 'two', path: 'scripts/npc/walk.ts' },
    { id: 'three', path: 'rules.ts' },
  ],
})

describe('the table a script reference resolves through', () => {
  it('answers the path it holds, and nothing for an identifier it does not', () => {
    expect(scriptPathOf(withScripts(), 'two')).toBe('scripts/npc/walk.ts')
    expect(scriptPathOf(withScripts(), 'four')).toBeNull()
  })

  it('follows a file that moved, and every script under a folder that did', () => {
    const renamed = withScriptMoved(withScripts(), 'rules.ts', 'game/rules.ts')
    expect(scriptPathOf(renamed, 'three')).toBe('game/rules.ts')

    const moved = withScriptMoved(withScripts(), 'scripts', 'game/logic')
    expect(moved.scripts.map(script => script.path)).toEqual([
      'game/logic/player.ts',
      'game/logic/npc/walk.ts',
      'rules.ts',
    ])
  })

  it('forgets a file that went away, and every script under a folder that did', () => {
    expect(withScriptForgotten(withScripts(), 'rules.ts').scripts.map(script => script.id)).toEqual(
      ['one', 'two'],
    )
    expect(
      withScriptForgotten(withScripts(), 'scripts/npc').scripts.map(script => script.id),
    ).toEqual(['one', 'three'])
  })

  /**
   * The root is not a folder anything renames or deletes, and `isUnder` answers TRUE for every
   * path when asked about it — which would rewrite or drop the whole table.
   */
  it('leaves the table alone when asked about the project root', () => {
    expect(withScriptMoved(withScripts(), '', 'game').scripts).toEqual(withScripts().scripts)
    expect(withScriptForgotten(withScripts(), '').scripts).toHaveLength(3)
  })

  /** A folder is followed by `/`, never by a prefix: `scripts2/` is not inside `scripts`. */
  it('leaves alone a path the folder merely begins', () => {
    const game = { ...emptyGame(), scripts: [{ id: 'one', path: 'scripts2/player.ts' }] }

    expect(withScriptMoved(game, 'scripts', 'logic').scripts[0]?.path).toBe('scripts2/player.ts')
    expect(withScriptForgotten(game, 'scripts').scripts).toHaveLength(1)
  })
})
