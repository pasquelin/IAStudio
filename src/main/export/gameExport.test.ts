import { describe, expect, it } from 'vitest'
import { EXPORTED_GAME_FILE, type ExportedGame } from '@shared/domain/gameExport'
import type { GameExportRequest } from '@shared/domain/gameExport'
import { writeExportedGame, type GameExportPorts } from './gameExport'

const SCENE = (id: string, assetIds: readonly string[] = []): string =>
  JSON.stringify({ nodes: assetIds.map(assetId => ({ id, material: { map: { assetId } } })) })

const ASKED: GameExportRequest = {
  title: 'Demo',
  entryScene: 'doc-1',
  scenes: [{ id: 'doc-1', title: 'Menu', content: SCENE('a', ['tex-1']) }],
  scripts: [{ script: 'script:levels/Walk.ts', code: 'export {}' }],
}

function writing(over: Partial<GameExportPorts> = {}) {
  const written = new Map<string, string | Uint8Array>()
  const ports: GameExportPorts = {
    assetFiles: ids =>
      Promise.resolve(
        new Map(
          ids
            .filter(id => id === 'tex-1')
            .map(id => [id, { name: 'checker.png', bytes: new Uint8Array([1]) }]),
        ),
      ),
    runtime: () =>
      Promise.resolve([
        { name: 'runtime.js', body: new Uint8Array([2]) },
        { name: 'rapier-abc.js', body: new Uint8Array([3]) },
      ]),
    write: (relative, body) => {
      written.set(relative, body)
      return Promise.resolve()
    },
    ...over,
  }
  return { ports, written }
}

const manifestOf = (written: Map<string, string | Uint8Array>): ExportedGame =>
  JSON.parse(String(written.get(EXPORTED_GAME_FILE) ?? '{}'))

describe('a game written to run with no studio', () => {
  it('writes the page, the bundle, the manifest, the scenes and the scripts', async () => {
    const { ports, written } = writing()

    const report = await writeExportedGame(ports, ASKED)

    // 🛑 The chunks too: `runtime.js` imports Rapier and the sandbox by name, and a page shipped
    // with the entry alone loads nothing at all.
    expect([...written.keys()].sort()).toEqual([
      'assets/checker.png',
      'game.json',
      'index.html',
      'rapier-abc.js',
      'runtime.js',
      'scenes/doc-1.gltf',
      'scripts/Walk.js',
    ])
    expect(report).toMatchObject({ scenes: 1, scripts: 1, assets: 1, missing: [] })
  })

  /** 🛑 § 19.3: only what is reached is copied, and what is missed is LISTED. */
  it('copies only the assets a scene names, and lists the ones nothing holds', async () => {
    const { ports, written } = writing()

    const report = await writeExportedGame(ports, {
      ...ASKED,
      scenes: [{ id: 'doc-1', title: 'Menu', content: SCENE('a', ['tex-1', 'gone']) }],
    })

    expect(report.missing).toEqual(['gone'])
    expect(manifestOf(written).assets).toEqual({ 'tex-1': 'assets/checker.png' })
  })

  it('names the same asset once, however many scenes reach it', async () => {
    const { ports } = writing()

    const report = await writeExportedGame(ports, {
      ...ASKED,
      entryScene: 'a',
      scenes: [
        { id: 'a', title: 'A', content: SCENE('a', ['tex-1']) },
        { id: 'b', title: 'B', content: SCENE('b', ['tex-1']) },
      ],
    })

    expect(report.assets).toBe(1)
  })

  /**
   * 🛑 A document id comes from the WINDOW over IPC, and every path here is composed from one.
   * Written raw, `scenes/../../x.gltf` lands wherever it points.
   */
  it('writes a scene whose id would climb out of the folder inside it all the same', async () => {
    const { ports, written } = writing()

    await writeExportedGame(ports, {
      ...ASKED,
      entryScene: '../../evil',
      scenes: [{ id: '../../evil', title: 'Menu', content: SCENE('a') }],
    })

    expect([...written.keys()].every(path => !path.includes('..'))).toBe(true)
  })

  /** The page is markup and a title is a person's words: one may close a tag inside the other. */
  it('escapes a title that would close the tag it sits in', async () => {
    const { ports, written } = writing()

    await writeExportedGame(ports, { ...ASKED, title: '</title><script>x' })

    expect(String(written.get('index.html'))).toContain('&lt;/title&gt;&lt;script&gt;x')
  })

  it('says which scene the game opens on, and where each one sits', async () => {
    const { ports, written } = writing()

    await writeExportedGame(ports, ASKED)

    expect(manifestOf(written)).toMatchObject({
      entryScene: 'doc-1',
      scenes: [{ id: 'doc-1', title: 'Menu', file: 'scenes/doc-1.gltf' }],
      scripts: [{ script: 'script:levels/Walk.ts', file: 'scripts/Walk.js' }],
    })
  })
})
