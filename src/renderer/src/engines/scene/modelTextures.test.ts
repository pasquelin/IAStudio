import {
  Mesh,
  MeshStandardMaterial,
  Object3D,
  RepeatWrapping,
  SRGBColorSpace,
  Texture,
} from 'three'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createModelTextures } from './modelTextures'
import { scriptedTextureCache } from './scene-fixtures'
import { instanceOf } from './modelCache'
import { geometryFor } from './threeFactory'

/** A parsed file: one mesh wearing one material, already dressed with the map it ships. */
function loadedModel(): { source: Object3D; fileMap: Texture } {
  const fileMap = new Texture()
  const material = new MeshStandardMaterial()
  material.map = fileMap

  const source = new Object3D()
  source.add(new Mesh(geometryFor({ kind: 'box', width: 1, height: 1, depth: 1 }), material))
  return { source, fileMap }
}

/** The one material of an instance, whatever depth the file put it at. */
function materialOf(root: Object3D): MeshStandardMaterial {
  let found: MeshStandardMaterial | null = null
  root.traverse(object => {
    if (object instanceof Mesh && object.material instanceof MeshStandardMaterial) {
      found = found ?? object.material
    }
  })
  if (!found) throw new Error('the fixture builds one standard material')
  return found
}

let onChange: () => void

beforeEach(() => {
  onChange = vi.fn()
})

describe('createModelTextures', () => {
  it('puts the project picture over the map the file carries', async () => {
    const scripted = scriptedTextureCache()
    const { source } = loadedModel()
    const instance = instanceOf(source)
    const textures = createModelTextures(scripted.cache, instance, onChange)

    textures.apply({ map: { assetId: 'tex-1' } })
    const loaded = await scripted.settle('tex-1')

    // The SOURCE, not the instance: an override wears the sampler of the map it replaces, so
    // what lands on the material is a clone sharing the picture — see `sampledLike`.
    expect(materialOf(instance).map?.source).toBe(loaded?.source)
    expect(scripted.spaces.get('tex-1')).toBe(SRGBColorSpace)
    expect(onChange).toHaveBeenCalled()
  })

  // The point of the whole file: `instanceOf` clones a tree but SHARES its materials, so writing
  // a map straight into one would repaint every other node built from the same file.
  it('leaves the other instances of the same file alone', async () => {
    const scripted = scriptedTextureCache()
    const { source, fileMap } = loadedModel()
    const dressed = instanceOf(source)
    const untouched = instanceOf(source)
    const textures = createModelTextures(scripted.cache, dressed, onChange)

    textures.apply({ map: { assetId: 'tex-1' } })
    const loaded = await scripted.settle('tex-1')

    expect(materialOf(dressed).map?.source).toBe(loaded?.source)
    expect(materialOf(untouched).map).toBe(fileMap)
    expect(materialOf(source).map).toBe(fileMap)
  })

  it('puts the file own map back when the override is removed', async () => {
    const scripted = scriptedTextureCache()
    const { source, fileMap } = loadedModel()
    const instance = instanceOf(source)
    const textures = createModelTextures(scripted.cache, instance, onChange)

    textures.apply({ map: { assetId: 'tex-1' } })
    await scripted.settle('tex-1')
    textures.apply({})

    expect(scripted.released).toEqual(['tex-1'])
    expect(materialOf(instance).map).toBe(fileMap)
  })

  it('gives every reference back when the node goes', async () => {
    const scripted = scriptedTextureCache()
    const { source, fileMap } = loadedModel()
    const instance = instanceOf(source)
    const textures = createModelTextures(scripted.cache, instance, onChange)

    textures.apply({ map: { assetId: 'a' }, normalMap: { assetId: 'b' } })
    await scripted.settle('a')
    textures.dispose()

    expect(scripted.released.sort()).toEqual(['a', 'b'])
    expect(materialOf(instance).map).toBe(fileMap)
  })

  it('disposes the cloned materials, not the ones the file still holds', () => {
    const scripted = scriptedTextureCache()
    const { source } = loadedModel()
    const instance = instanceOf(source)
    const textures = createModelTextures(scripted.cache, instance, onChange)
    const clone = materialOf(instance)
    const file = materialOf(source)
    const disposeClone = vi.spyOn(clone, 'dispose')
    const disposeFile = vi.spyOn(file, 'dispose')

    textures.dispose()

    expect(disposeClone).toHaveBeenCalledOnce()
    expect(disposeFile).not.toHaveBeenCalled()
  })

  /**
   * Taken at build time rather than at the first override, and the display modes are why: one
   * swaps `mesh.material` for a stand-in shared by the whole scene, so a late copy would clone the
   * CLAY and hand `PaneMemory` a material it takes for the model's own.
   */
  it('takes its own copy of the materials as soon as the file lands', () => {
    const scripted = scriptedTextureCache()
    const { source } = loadedModel()
    const instance = instanceOf(source)
    const shared = materialOf(instance)

    createModelTextures(scripted.cache, instance, onChange)

    expect(materialOf(instance)).not.toBe(shared)
    expect(materialOf(source)).toBe(shared)
  })

  // `KHR_materials_unlit` brings a `MeshBasicMaterial`, which has no slot to write into. The
  // inspector still offers five of them, so the refusal is said rather than left silent.
  it('says so when the model carries nothing a map can be written into', () => {
    const scripted = scriptedTextureCache()
    const unlit = new Object3D()
    unlit.add(new Mesh(geometryFor({ kind: 'box', width: 1, height: 1, depth: 1 })))
    const undressable = vi.fn()

    createModelTextures(scripted.cache, unlit, onChange, undressable).apply({
      map: { assetId: 'tex-1' },
    })

    expect(undressable).toHaveBeenCalled()
  })

  /**
   * glTF stores its UVs for an unflipped picture, and `GLTFLoader` configures no orientation —
   * asked the studio's own way up, an override lands upside down over the map it replaces.
   */
  it('asks for its pictures the way up the model file stores them', async () => {
    const scripted = scriptedTextureCache()
    const { source } = loadedModel()
    const instance = instanceOf(source)

    createModelTextures(scripted.cache, instance, onChange).apply({
      map: { assetId: 'tex-base' },
    })
    await scripted.settle('tex-base')

    expect(scripted.orientations.get('tex-base')).toBe('from-image')
  })

  /**
   * A `.glb` whose map tiles says so on the SAMPLER, not in the picture. Posted bare, an override
   * reverted every model to ClampToEdge at 1×1 — a slot at a time it was rare, the button that
   * fills five at once makes it a single click.
   */
  it('dresses the override with the sampler of the map it replaces', async () => {
    const scripted = scriptedTextureCache()
    const { source, fileMap } = loadedModel()
    fileMap.wrapS = RepeatWrapping
    fileMap.wrapT = RepeatWrapping
    fileMap.repeat.set(4, 2)
    fileMap.offset.set(0.25, 0.5)
    fileMap.channel = 1
    const instance = instanceOf(source)

    createModelTextures(scripted.cache, instance, onChange).apply({
      map: { assetId: 'tex-base' },
    })
    await scripted.settle('tex-base')

    const worn = materialOf(instance).map
    expect(worn?.repeat.toArray()).toEqual([4, 2])
    expect(worn?.offset.toArray()).toEqual([0.25, 0.5])
    expect(worn?.wrapS).toBe(RepeatWrapping)
    expect(worn?.channel).toBe(1)
  })

  /**
   * The clone carries its own wrapping, and `getTextureCacheKey` reads it — so three allocates a
   * SECOND GPU texture for it, one the cache never hears about. Left alone, every ⌘S on the
   * picture and every reopening of the scene grew `info.memory.textures` for the session.
   */
  it('frees the clone it wore when the model goes away', async () => {
    const scripted = scriptedTextureCache()
    const { source, fileMap } = loadedModel()
    fileMap.repeat.set(2, 2)
    const instance = instanceOf(source)
    const textures = createModelTextures(scripted.cache, instance, onChange)

    textures.apply({ map: { assetId: 'tex-base' } })
    await scripted.settle('tex-base')
    const worn = materialOf(instance).map
    const freed = vi.spyOn(worn as Texture, 'dispose')

    textures.dispose()

    expect(freed).toHaveBeenCalled()
  })
})
