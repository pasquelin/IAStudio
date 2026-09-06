import { beforeEach, describe, expect, it, vi } from 'vitest'
import { INPUT_MAP_EXTENSION, type InputMap } from '@shared/domain/inputMap'
import { seedTemplateFiles } from './seedTemplateFiles'

const written: { maps: [string, InputMap][]; scripts: [string, string][] } = {
  maps: [],
  scripts: [],
}
let taken: string[] = []
let heldScripts: { path: string }[] = []

vi.mock('@/services/bridge', () => ({
  getBridge: () => ({
    project: {
      folderFor: (role: string) => Promise.resolve(role === 'input' ? 'Controls' : 'Scripts'),
    },
    inputMaps: {
      list: () => Promise.resolve(taken),
      write: (path: string, map: InputMap) => {
        written.maps.push([path, map])
        return Promise.resolve(true)
      },
    },
    game: {
      scripts: () => Promise.resolve(heldScripts),
      writeScript: (path: string, source: string) => {
        written.scripts.push([path, source])
        return Promise.resolve(true)
      },
    },
  }),
}))

vi.mock('@/stores/documents', () => ({
  useDocuments: { getState: () => ({ relist: () => Promise.resolve() }) },
}))

const installed: [string, string][] = []
vi.mock('@/stores/code', () => ({
  scriptRefAt: (path: string) => `script:${path}`,
  useCode: {
    getState: () => ({
      installed: (script: string, source: string) => void installed.push([script, source]),
    }),
  },
}))

describe('the files a scene template lays down', () => {
  beforeEach(() => {
    written.maps = []
    written.scripts = []
    installed.length = 0
    taken = []
    heldScripts = []
  })

  it('writes the control map and the script of what the template plays', async () => {
    await seedTemplateFiles('thirdPerson')

    expect(written.maps.map(([path]) => path)).toEqual([`Controls/character${INPUT_MAP_EXTENSION}`])
    expect(written.scripts.map(([path]) => path)).toEqual(['Scripts/player.ts'])
  })

  it('names the context after the FILE, so a scene resolves its actions against it', async () => {
    await seedTemplateFiles('car')

    expect(written.maps[0]?.[1].id).toBe('vehicle')
    expect(written.scripts[0]?.[1]).toContain("ctx.input.axis('accelerate')")
  })

  it('leaves a map the project already holds alone, whatever its case on disk', async () => {
    taken = [`Controls/CHARACTER${INPUT_MAP_EXTENSION}`]

    await seedTemplateFiles('topDown')

    expect(written.maps).toEqual([])
    expect(written.scripts).not.toEqual([])
  })

  /** 🛑 `game.writeScript` OVERWRITES: a second scene threw away the first author's work. */
  it('leaves a script the project already holds alone', async () => {
    heldScripts = [{ path: 'Scripts/player.ts' }]

    await seedTemplateFiles('thirdPerson')

    expect(written.scripts).toEqual([])
    expect(installed).toEqual([])
  })

  /** Without it the field that points at the script calls the file it just wrote missing. */
  it('tells the editor store about the script it just wrote', async () => {
    await seedTemplateFiles('thirdPerson')

    expect(installed[0]?.[0]).toBe('script:Scripts/player.ts')
  })

  it('lays nothing down for a template nobody plays', async () => {
    await seedTemplateFiles('photoStudio')

    expect(written.maps).toEqual([])
    expect(written.scripts).toEqual([])
  })
})
