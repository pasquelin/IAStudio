import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { GameExportRequest } from '@shared/domain/gameExport'
import { installFakeBridge } from '@/services/fakeBridge'
import { installDocument } from '@/stores/document-fixtures'
import { installScene } from '@/stores/scene-fixtures'
import { useProject } from '@/stores/project'
import { runAction } from './executor'

const DOCUMENT = 'doc-1'

function exporting(answer: GameExportRequest['scenes'] extends never ? never : boolean = true) {
  const asked: GameExportRequest[] = []
  installFakeBridge({
    game: {
      export: request => {
        asked.push(request)
        return Promise.resolve(
          answer ? { folder: 'Demo', scenes: 1, scripts: 0, assets: 0, missing: [] } : null,
        )
      },
    },
  })
  return asked
}

describe('a game written out of the studio', () => {
  beforeEach(() => {
    installScene(DOCUMENT)
    installDocument(DOCUMENT, '3d')
    useProject.setState({
      project: { path: '/p', manifest: { name: 'Demo' } },
      known: true,
    } as never)
    vi.stubGlobal('Worker', class {} as never)
  })

  it('hands over every scene of the project, as the glTF a save writes', async () => {
    const asked = exporting()

    const outcome = await runAction('game.export', {})

    expect(outcome).toMatchObject({ ok: true, data: { folder: 'Demo' } })
    expect(asked[0]?.scenes.map(one => one.id)).toEqual([DOCUMENT])
    expect(String(asked[0]?.scenes[0]?.content)).toContain('asset')
    expect(asked[0]?.scenes[0]?.assetIds).toEqual([])
  })

  /** 🛑 A caller that named a scene and got the FIRST one exported the wrong game, saying `ok`. */
  it('refuses a scene the project does not hold rather than exporting another', async () => {
    exporting()

    expect(await runAction('game.export', { entryScene: 'Nowhere' })).toMatchObject({
      ok: false,
      refusal: 'badInput',
    })
  })

  it('refuses when nobody picked a folder', async () => {
    exporting(false)

    expect(await runAction('game.export', {})).toMatchObject({ ok: false, refusal: 'declined' })
  })

  /**
   * 🛑 With no folder named, the main process raises a system picker — which a caller on the wire
   * can neither fill in nor see. It stood on screen while the client counted its two minutes out.
   */
  it('refuses to raise a picker for a caller with no screen', async () => {
    const asked = exporting()

    expect(await runAction('game.export', {}, {})).toMatchObject({
      ok: false,
      refusal: 'nativeDialog',
    })
    expect(asked).toEqual([])
  })

  it('writes where that caller named, no picker involved', async () => {
    const asked = exporting()

    expect(await runAction('game.export', { folder: 'Builds' }, {})).toMatchObject({ ok: true })
    expect(asked[0]?.folder).toBe('Builds')
  })

  /** 🛑 `resources/gameRuntime` is git-ignored, so the main process throws where an assistant is
   * owed an answer. */
  it('answers a refusal when the main process throws instead of writing', async () => {
    installFakeBridge({
      game: {
        export: () =>
          Promise.reject(new Error('no game runtime is built: run `pnpm game:runtime`')),
      },
    })

    expect(await runAction('game.export', {})).toMatchObject({
      ok: false,
      refusal: 'failed',
      detail: expect.stringContaining('pnpm game:runtime'),
    })
  })
})
