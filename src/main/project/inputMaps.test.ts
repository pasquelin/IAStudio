import { mkdtemp, readFile, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { createInputMaps } from './inputMaps'

describe('project input maps', () => {
  let root: string

  beforeEach(async () => {
    root = await mkdtemp(join(tmpdir(), 'ia-input-maps-'))
  })

  afterEach(async () => {
    await rm(root, { recursive: true, force: true })
  })

  it('writes a versioned input map inside the project', async () => {
    const maps = createInputMaps({ rootOf: () => root })
    const wrote = await maps.write('Controls/character.input.json', {
      version: 1,
      id: 'character',
      priority: 0,
      defaultActive: true,
      actions: [],
    })

    expect(wrote).toBe(true)
    expect(JSON.parse(await readFile(join(root, 'Controls/character.input.json'), 'utf8'))).toMatchObject({
      id: 'character',
    })
  })
})
