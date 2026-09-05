// SPDX-License-Identifier: MIT
import { describe, expect, it } from 'vitest'
import type { InputMap } from '@shared/domain/inputMap'
import { installFakeBridge } from '@/services/fakeBridge'
import { inputMapIdConflict, projectInputMaps } from './projectInputMaps'

const CHARACTER: InputMap = {
  version: 1,
  id: 'character',
  priority: 0,
  defaultActive: true,
  actions: [],
}

describe('project input maps for scripts', () => {
  it('loads each listed map with the path imports resolve against', async () => {
    installFakeBridge({
      inputMaps: {
        list: () => Promise.resolve(['Scripts/character.input.json']),
        read: () => Promise.resolve(CHARACTER),
      },
    })

    expect(await projectInputMaps()).toEqual([
      { path: 'Scripts/character.input.json', map: CHARACTER },
    ])
  })

  it('leaves one unreadable map out without losing the others', async () => {
    installFakeBridge({
      inputMaps: {
        list: () => Promise.resolve(['broken.input.json', 'character.input.json']),
        read: path =>
          path.startsWith('broken')
            ? Promise.reject(new Error('broken'))
            : Promise.resolve(CHARACTER),
      },
    })

    expect(await projectInputMaps()).toEqual([{ path: 'character.input.json', map: CHARACTER }])
  })

  it('keeps duplicate context files available to relative script imports', async () => {
    installFakeBridge({
      inputMaps: {
        list: () => Promise.resolve(['Controls/a.input.json', 'Controls/b.input.json']),
        read: path => Promise.resolve({ ...CHARACTER, priority: path.includes('/a.') ? 0 : 10 }),
      },
    })

    expect(await projectInputMaps()).toEqual([
      { path: 'Controls/a.input.json', map: CHARACTER },
      { path: 'Controls/b.input.json', map: { ...CHARACTER, priority: 10 } },
    ])
    expect(inputMapIdConflict(await projectInputMaps())?.path).toBe('Controls/b.input.json')
  })
})
