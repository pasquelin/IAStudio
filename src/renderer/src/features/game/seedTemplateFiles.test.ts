import { beforeEach, describe, expect, it, vi } from 'vitest'
import { INPUT_MAP_EXTENSION, type InputMap } from '@shared/domain/inputMap'
import { seedTemplateFiles } from './seedTemplateFiles'

const written: { maps: [string, InputMap][]; scripts: [string, string][] } = {
  maps: [],
  scripts: [],
}
let taken: string[] = []

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

describe('the files a scene template lays down', () => {
  beforeEach(() => {
    written.maps = []
    written.scripts = []
    taken = []
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

  it('lays nothing down for a template nobody plays', async () => {
    await seedTemplateFiles('photoStudio')

    expect(written.maps).toEqual([])
    expect(written.scripts).toEqual([])
  })
})
