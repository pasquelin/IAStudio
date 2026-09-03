import { Mesh, Texture, type BufferGeometry, type Material, type Object3D } from 'three'
import { TEXTURE_SLOTS } from '@shared/domain/scene'

export type RuntimeDeduplicationImpact = {
  geometries: number
  materials: number
  textures: number
}

/** Deduplicates resources owned by a disposable Runtime World, never by the authoring scene. */
export function deduplicateRuntimeResources(root: Object3D): RuntimeDeduplicationImpact {
  const impact: RuntimeDeduplicationImpact = { geometries: 0, materials: 0, textures: 0 }
  const geometries = new Map<string, BufferGeometry>()
  const materials = new Map<string, Material>()
  const textures = new Map<string, Texture>()
  const sourceIds = new WeakMap<object, number>()
  let nextSourceId = 0

  const canonicalTexture = (texture: Texture): Texture => {
    const data: unknown = texture.source.data
    if ((typeof data !== 'object' && typeof data !== 'function') || data === null) return texture
    let sourceId = sourceIds.get(data)
    if (sourceId === undefined) {
      sourceId = nextSourceId
      nextSourceId += 1
      sourceIds.set(data, sourceId)
    }
    const key = JSON.stringify([
      sourceId,
      texture.mapping,
      texture.channel,
      texture.wrapS,
      texture.wrapT,
      texture.magFilter,
      texture.minFilter,
      texture.anisotropy,
      texture.format,
      texture.internalFormat,
      texture.type,
      texture.offset.toArray(),
      texture.repeat.toArray(),
      texture.center.toArray(),
      texture.rotation,
      texture.matrixAutoUpdate,
      texture.generateMipmaps,
      texture.premultiplyAlpha,
      texture.flipY,
      texture.unpackAlignment,
      texture.colorSpace,
    ])
    const known = textures.get(key)
    if (known) {
      if (known !== texture) {
        texture.dispose()
        impact.textures += 1
      }
      return known
    }
    textures.set(key, texture)
    return texture
  }

  root.traverse(object => {
    if (!(object instanceof Mesh)) return
    const geometryKey = canonicalJson(object.geometry.toJSON())
    const geometry = geometries.get(geometryKey)
    if (geometry && geometry !== object.geometry) {
      object.geometry.dispose()
      object.geometry = geometry
      impact.geometries += 1
    } else geometries.set(geometryKey, object.geometry)

    const entries = Array.isArray(object.material) ? object.material : [object.material]
    for (const material of entries) {
      for (const slot of TEXTURE_SLOTS) {
        const texture: unknown = Reflect.get(material, slot)
        if (texture instanceof Texture) Reflect.set(material, slot, canonicalTexture(texture))
      }
    }
    const canonical = entries.map(material => {
      const key = canonicalJson(material.toJSON())
      const known = materials.get(key)
      if (known) {
        if (known !== material) {
          material.dispose()
          impact.materials += 1
        }
        return known
      }
      materials.set(key, material)
      return material
    })
    object.material = Array.isArray(object.material) ? canonical : (canonical[0] ?? object.material)
  })
  return impact
}

function canonicalJson(value: unknown): string {
  return JSON.stringify(withoutIdentity(value))
}

function withoutIdentity(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(withoutIdentity)
  if (typeof value !== 'object' || value === null) return value
  return Object.fromEntries(
    Object.entries(value)
      .filter(([key]) => key !== 'uuid' && key !== 'metadata')
      .map(([key, entry]) => [key, withoutIdentity(entry)]),
  )
}
