import { describe, expect, it, vi } from 'vitest'
import { emptyGame, type GameManifest, type GameState } from '@shared/domain/game'
import { GameLockedError, type ProjectGameStore } from './game'
import { keepScriptPaths } from './scriptPaths'

const holding = (scripts: GameManifest['scripts']): GameState => ({
  game: { ...emptyGame(), scripts },
  trouble: null,
})

function store(state: GameState): ProjectGameStore & { written: GameManifest[] } {
  const written: GameManifest[] = []
  return {
    written,
    read: vi.fn(async () => state),
    write: vi.fn(async (game: GameManifest) => {
      written.push(game)
      return { game, trouble: null }
    }),
  }
}

/**
 * 🛑 The one thing the studio references by PATH. Nothing reads `game.json` until a Play, so a
 * script left pointing at a path the disk lost goes unnoticed until the game refuses to run.
 */
describe('what a moved script does to the manifest', () => {
  it('follows a script that was renamed', async () => {
    const game = store(holding([{ id: 's1', path: 'Scripts/Walk.ts' }]))

    await keepScriptPaths(game, [{ from: 'Scripts/Walk.ts', to: 'Scripts/Run.ts' }])

    expect(game.written[0]?.scripts).toEqual([{ id: 's1', path: 'Scripts/Run.ts' }])
  })

  /** A folder rename moves every script under it at once — one change, many scripts. */
  it('follows every script under a folder that moved', async () => {
    const game = store(
      holding([
        { id: 's1', path: 'Scripts/Walk.ts' },
        { id: 's2', path: 'Scripts/Doors/Open.ts' },
      ]),
    )

    await keepScriptPaths(game, [{ from: 'Scripts', to: 'Code' }])

    expect(game.written[0]?.scripts).toEqual([
      { id: 's1', path: 'Code/Walk.ts' },
      { id: 's2', path: 'Code/Doors/Open.ts' },
    ])
  })

  it('forgets a script that went to the trash', async () => {
    const game = store(holding([{ id: 's1', path: 'Walk.ts' }]))

    await keepScriptPaths(game, [{ from: 'Walk.ts', to: '' }])

    expect(game.written[0]?.scripts).toEqual([])
  })

  it('writes nothing at all when no script was touched', async () => {
    const game = store(holding([{ id: 's1', path: 'Walk.ts' }]))

    await keepScriptPaths(game, [{ from: 'picture.png', to: 'shots/picture.png' }])

    expect(game.write).not.toHaveBeenCalled()
  })

  /** A manifest the studio cannot read is the author's to repair; a rename must not say so. */
  it('leaves a manifest it cannot read alone', async () => {
    const game = store({ game: emptyGame(), trouble: 'too-new' })

    await keepScriptPaths(game, [{ from: 'Walk.ts', to: 'Run.ts' }])

    expect(game.write).not.toHaveBeenCalled()
  })

  /** Called for its effect from a batch already finished: an unhandled rejection kills the process. */
  it('never throws, whatever the write answers', async () => {
    const game = store(holding([{ id: 's1', path: 'Walk.ts' }]))
    game.write = vi.fn(async () => {
      throw new GameLockedError('unreadable')
    })

    await expect(
      keepScriptPaths(game, [{ from: 'Walk.ts', to: 'Run.ts' }]),
    ).resolves.toBeUndefined()
  })
})
