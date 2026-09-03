import { BoxGeometry, Mesh, MeshStandardMaterial, Object3D, Texture } from 'three'
import { describe, expect, it, vi } from 'vitest'
import { deduplicateRuntimeResources } from './runtimeDeduplication'

describe('deduplicateRuntimeResources', () => {
  it('shares exact geometry, material and texture copies inside a runtime world', () => {
    const image = { width: 1, height: 1 }
    const firstTexture = new Texture(image)
    const secondTexture = new Texture(image)
    const firstMaterial = new MeshStandardMaterial({ map: firstTexture, roughness: 0.4 })
    const secondMaterial = new MeshStandardMaterial({ map: secondTexture, roughness: 0.4 })
    const first = new Mesh(new BoxGeometry(), firstMaterial)
    const second = new Mesh(new BoxGeometry(), secondMaterial)
    const root = new Object3D().add(first, second)

    expect(deduplicateRuntimeResources(root)).toEqual({
      geometries: 1,
      materials: 1,
      textures: 1,
    })
    expect(second.geometry).toBe(first.geometry)
    expect(second.material).toBe(first.material)
    expect(secondMaterial.map).toBe(firstTexture)
  })

  it('keeps rendering variants and differently sampled textures distinct', () => {
    const image = { width: 1, height: 1 }
    const firstTexture = new Texture(image)
    const secondTexture = new Texture(image)
    secondTexture.flipY = false
    const first = new Mesh(new BoxGeometry(), new MeshStandardMaterial({ map: firstTexture }))
    const secondMaterial = new MeshStandardMaterial({ map: secondTexture, transparent: true })
    const second = new Mesh(new BoxGeometry(), secondMaterial)

    deduplicateRuntimeResources(new Object3D().add(first, second))

    expect(second.material).toBe(secondMaterial)
    expect(secondMaterial.map).toBe(secondTexture)
  })

  it('disposes only duplicate resources owned by the runtime world', () => {
    const first = new Mesh(new BoxGeometry(), new MeshStandardMaterial())
    const second = new Mesh(new BoxGeometry(), new MeshStandardMaterial())
    const geometryDispose = vi.spyOn(second.geometry, 'dispose')
    const materialDispose = vi.spyOn(second.material, 'dispose')

    deduplicateRuntimeResources(new Object3D().add(first, second))

    expect(geometryDispose).toHaveBeenCalledOnce()
    expect(materialDispose).toHaveBeenCalledOnce()
  })
})
