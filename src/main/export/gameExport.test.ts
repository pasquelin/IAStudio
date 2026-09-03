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
        { name: 'jolt-abc.js', body: new Uint8Array([3]) },
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

    // 🛑 The chunks too: `runtime.js` imports the physics and the sandbox by name, and a page shipped
    // with the entry alone loads nothing at all.
    expect([...written.keys()].sort()).toEqual([
      'assets/checker.png',
      'game.json',
      'index.html',
      'jolt-abc.js',
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

  it('trusts typed runtime reachability instead of shipping an unused scene reference', async () => {
    const asked: string[][] = []
    const { ports, written } = writing({
      assetFiles: ids => {
        asked.push([...ids])
        return Promise.resolve(new Map())
      },
    })

    await writeExportedGame(ports, {
      ...ASKED,
      scenes: [
        {
          id: 'doc-1',
          title: 'Menu',
          content: SCENE('a', ['unused-sky']),
          assetIds: [],
        },
      ],
    })

    expect(asked).toEqual([[]])
    expect(manifestOf(written).assets).toEqual({})
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

  it('files byte-identical asset ids once while preserving both logical references', async () => {
    const { ports, written } = writing({
      assetFiles: () =>
        Promise.resolve(
          new Map([
            ['first', { name: 'first.png', bytes: new Uint8Array([1, 2]) }],
            ['second', { name: 'second.png', bytes: new Uint8Array([1, 2]) }],
          ]),
        ),
    })

    const report = await writeExportedGame(ports, {
      ...ASKED,
      scenes: [{ id: 'doc-1', title: 'Menu', content: SCENE('a', ['first', 'second']) }],
    })

    expect(manifestOf(written).assets).toEqual({
      first: 'assets/first.png',
      second: 'assets/first.png',
    })
    expect([...written.keys()].filter(name => name.startsWith('assets/'))).toEqual([
      'assets/first.png',
    ])
    expect(report.assets).toBe(2)
  })

  it('keeps different bytes apart even when their recorded fingerprints collide', async () => {
    const { ports, written } = writing({
      assetFiles: () =>
        Promise.resolve(
          new Map([
            ['first', { name: 'first.png', bytes: new Uint8Array([1]), hash: 'same' }],
            ['second', { name: 'second.png', bytes: new Uint8Array([2]), hash: 'same' }],
          ]),
        ),
    })

    await writeExportedGame(ports, {
      ...ASKED,
      scenes: [{ id: 'doc-1', title: 'Menu', content: SCENE('a', ['first', 'second']) }],
    })

    expect(new Set(Object.values(manifestOf(written).assets)).size).toBe(2)
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
    expect([...written.keys()]).toContain('scenes/evil.gltf')
  })

  /** 🛑 Two ids that clean to one name would otherwise overwrite each other, in silence. */
  it('gives two scenes that clean to one name a file each', async () => {
    const { ports, written } = writing()

    await writeExportedGame(ports, {
      ...ASKED,
      scenes: [
        { id: '../a', title: 'A', content: SCENE('a') },
        { id: '..\\a', title: 'B', content: SCENE('b') },
      ],
    })

    expect([...written.keys()].filter(path => path.startsWith('scenes/')).sort()).toEqual([
      'scenes/a-2.gltf',
      'scenes/a.gltf',
    ])
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

  it('writes byte-equivalent packages twice from the same request', async () => {
    const first = writing()
    const second = writing()

    await writeExportedGame(first.ports, ASKED)
    await writeExportedGame(second.ports, ASKED)

    expect([...first.written.entries()].sort()).toEqual([...second.written.entries()].sort())
  })
})
