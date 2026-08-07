import { BufferAttribute, Mesh, MeshStandardMaterial, SRGBColorSpace, Texture } from 'three'
import type { MaterialDescriptor } from '@shared/domain/scene'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createMaterialTextures } from './material-textures'
import { DEFAULT_MATERIAL } from './scene-state'
import { geometryFor } from './three-factory'
import type { TextureCache } from './texture-cache'

/** A cache whose loads the test settles by hand, so arrival order is what is under test. */
function scriptedCache() {
  const pending = new Map<string, (texture: Texture | null) => void>()
  const acquired: string[] = []
  const released: string[] = []

  const cache: TextureCache = {
    acquire: assetId => {
      acquired.push(assetId)
      return new Promise(resolve => pending.set(assetId, resolve))
    },
    release: assetId => {
      released.push(assetId)
    },
    dispose: () => {},
  }

  return {
    cache,
    acquired,
    released,
    settle: async (assetId: string, texture: Texture | null = new Texture()) => {
      pending.get(assetId)?.(texture)
      await Promise.resolve()
      return texture
    },
  }
}

const withMap = (assetId: string | null): MaterialDescriptor => ({
  ...DEFAULT_MATERIAL,
  map: assetId ? { assetId } : null,
})

let mesh: Mesh
let material: MeshStandardMaterial
let onChange: () => void

beforeEach(() => {
  material = new MeshStandardMaterial()
  mesh = new Mesh(geometryFor({ kind: 'box', width: 1, height: 1, depth: 1 }), material)
  onChange = vi.fn()
})

describe('createMaterialTextures', () => {
  it('installs the texture a slot asks for', async () => {
    const scripted = scriptedCache()
    const textures = createMaterialTextures(scripted.cache, mesh, material, onChange)

    textures.apply(withMap('tex-1'))
    const texture = await scripted.settle('tex-1')

    expect(material.map).toBe(texture)
    expect(onChange).toHaveBeenCalled()
  })

  it('asks for nothing again while the slot has not moved', () => {
    const scripted = scriptedCache()
    const textures = createMaterialTextures(scripted.cache, mesh, material, onChange)

    textures.apply(withMap('tex-1'))
    textures.apply(withMap('tex-1'))

    expect(scripted.acquired).toEqual(['tex-1'])
  })

  it('gives the reference back when a slot is emptied', async () => {
    const scripted = scriptedCache()
    const textures = createMaterialTextures(scripted.cache, mesh, material, onChange)

    textures.apply(withMap('tex-1'))
    await scripted.settle('tex-1')
    textures.apply(withMap(null))

    expect(scripted.released).toEqual(['tex-1'])
    expect(material.map).toBeNull()
  })

  // Three textures picked in a row: the first to arrive must not overwrite the third.
  it('drops an arrival the slot has moved on from', async () => {
    const scripted = scriptedCache()
    const textures = createMaterialTextures(scripted.cache, mesh, material, onChange)

    textures.apply(withMap('tex-1'))
    textures.apply(withMap('tex-2'))
    textures.apply(withMap('tex-3'))

    const third = await scripted.settle('tex-3')
    await scripted.settle('tex-1')
    await scripted.settle('tex-2')

    expect(material.map).toBe(third)
  })

  it('takes and gives back one reference per change of mind', () => {
    const scripted = scriptedCache()
    const textures = createMaterialTextures(scripted.cache, mesh, material, onChange)

    textures.apply(withMap('tex-1'))
    textures.apply(withMap('tex-2'))
    textures.apply(withMap('tex-1'))

    expect(scripted.acquired).toEqual(['tex-1', 'tex-2', 'tex-1'])
    expect(scripted.released).toEqual(['tex-1', 'tex-2'])
  })

  // A texture released mid-load resolves to nothing: nothing must be installed.
  it('installs nothing when the load came back empty', async () => {
    const scripted = scriptedCache()
    const textures = createMaterialTextures(scripted.cache, mesh, material, onChange)

    textures.apply(withMap('tex-1'))
    await scripted.settle('tex-1', null)

    expect(material.map).toBeNull()
  })

  it('reads the base map as sRGB and leaves the data maps linear', async () => {
    const scripted = scriptedCache()
    const textures = createMaterialTextures(scripted.cache, mesh, material, onChange)

    textures.apply({
      ...DEFAULT_MATERIAL,
      map: { assetId: 'colour' },
      normalMap: { assetId: 'normal' },
    })
    const colour = await scripted.settle('colour')
    const normal = await scripted.settle('normal')

    expect(colour?.colorSpace).toBe(SRGBColorSpace)
    expect(normal?.colorSpace).not.toBe(SRGBColorSpace)
  })

  // Without a second UV set, ambient occlusion is a slot that quietly does nothing.
  it('gives the geometry a second UV set for an occlusion map', async () => {
    const scripted = scriptedCache()
    const textures = createMaterialTextures(scripted.cache, mesh, material, onChange)
    expect(mesh.geometry.attributes.uv1).toBeUndefined()

    textures.apply({ ...DEFAULT_MATERIAL, aoMap: { assetId: 'ao' } })
    await scripted.settle('ao')

    expect(mesh.geometry.attributes.uv1).toBe(mesh.geometry.attributes.uv)
  })

  it('leaves a second UV set the geometry already had alone', async () => {
    const own = new BufferAttribute(new Float32Array(48), 2)
    mesh.geometry.setAttribute('uv1', own)
    const scripted = scriptedCache()
    const textures = createMaterialTextures(scripted.cache, mesh, material, onChange)

    textures.apply({ ...DEFAULT_MATERIAL, aoMap: { assetId: 'ao' } })
    await scripted.settle('ao')

    expect(mesh.geometry.attributes.uv1).toBe(own)
  })

  it('gives every reference back when the mesh goes', async () => {
    const scripted = scriptedCache()
    const textures = createMaterialTextures(scripted.cache, mesh, material, onChange)

    textures.apply({ ...DEFAULT_MATERIAL, map: { assetId: 'a' }, aoMap: { assetId: 'b' } })
    await scripted.settle('a')
    textures.dispose()

    expect(scripted.released.sort()).toEqual(['a', 'b'])
    expect(material.map).toBeNull()
  })
})
