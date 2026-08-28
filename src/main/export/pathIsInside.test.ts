import { join, resolve, sep } from 'node:path'
import { describe, expect, it } from 'vitest'
import { pathIsInside } from './pathIsInside'

const ROOT = resolve(sep, 'games', 'Demo')

describe('whether a file lands inside the folder a game was written to', () => {
  it('takes a file of the folder and of a folder under it', () => {
    expect(pathIsInside(ROOT, join(ROOT, 'index.html'))).toBe(true)
    expect(pathIsInside(ROOT, join(ROOT, 'scenes', 'menu.gltf'))).toBe(true)
  })

  it('refuses the folder itself, which is not a file to write', () => {
    expect(pathIsInside(ROOT, ROOT)).toBe(false)
  })

  /** 🛑 `..` ALONE: neither empty, nor prefixed by a separator, nor absolute — it used to pass. */
  it('refuses the parent folder, however few segments the climb took', () => {
    expect(pathIsInside(ROOT, join(ROOT, '..'))).toBe(false)
    expect(pathIsInside(ROOT, join(ROOT, '..', '..', 'evil'))).toBe(false)
  })

  it('takes a file whose NAME begins with dots, which climbed nothing', () => {
    expect(pathIsInside(ROOT, join(ROOT, '..notes'))).toBe(true)
  })

  it('refuses a path of its own elsewhere on the disk', () => {
    expect(pathIsInside(ROOT, resolve(sep, 'etc', 'passwd'))).toBe(false)
  })
})
