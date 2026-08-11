import { Box3, Mesh, Vector3, type Material, type Object3D, type Texture } from 'three'

/**
 * What a model costs, counted off the geometry rather than off a drawn frame.
 *
 * `renderer.info` answers for the LAST frame — what was in the frustum, at that instant, for that
 * camera. A budget is a property of the model: the triangles it carries do not stop existing when
 * the camera turns away. Counted here so the number is the same in four views as in one.
 */
export type SceneStats = {
  triangles: number
  vertices: number
  /** Distinct geometries, which is what a draw call costs at best — instancing aside. */
  draws: number
  /** Bytes the textures occupy once decoded, uncompressed and without mipmaps. */
  textureBytes: number
}

export const EMPTY_STATS: SceneStats = { triangles: 0, vertices: 0, draws: 0, textureBytes: 0 }

/** Four bytes per texel: RGBA8, which is what an uncompressed upload costs on the GPU. */
const BYTES_PER_TEXEL = 4

/**
 * Counts a subtree, sharing nothing twice.
 *
 * Geometries and textures are counted per distinct object, not per mesh: ten cubes sharing one
 * box carry one box's triangles on the GPU, and a count that added them ten times would send
 * someone optimising a model that is already fine.
 */
export function statsOf(
  objects: Iterable<Object3D>,
  seen: { geometries?: Set<unknown>; textures?: Set<unknown> } = {},
): SceneStats {
  const geometries = seen.geometries ?? new Set<unknown>()
  const textures = seen.textures ?? new Set<unknown>()
  const stats = { ...EMPTY_STATS }

  for (const object of objects) {
    object.traverse(child => {
      if (!(child instanceof Mesh) || !child.visible) return

      const geometry = child.geometry
      if (!geometries.has(geometry)) {
        geometries.add(geometry)
        stats.vertices += vertexCount(geometry)
        stats.triangles += triangleCount(geometry)
      }
      // Counted per mesh, unlike the buffers: two meshes sharing a geometry are still two draws.
      stats.draws += 1

      for (const material of materialsOf(child)) {
        for (const texture of texturesOf(material)) {
          if (textures.has(texture)) continue
          textures.add(texture)
          stats.textureBytes += textureBytes(texture)
        }
      }
    })
  }

  return stats
}

type CountableGeometry = {
  index: { count: number } | null
  attributes: { position?: { count: number } }
}

function vertexCount(geometry: CountableGeometry): number {
  return geometry.attributes.position?.count ?? 0
}

function triangleCount(geometry: CountableGeometry): number {
  // The index is what the GPU actually draws through when there is one: a cube is 8 vertices and
  // 36 indices, and counting its positions would report a third of its triangles.
  const drawn = geometry.index?.count ?? vertexCount(geometry)
  return Math.floor(drawn / 3)
}

function materialsOf(mesh: Mesh): readonly Material[] {
  return Array.isArray(mesh.material) ? mesh.material : [mesh.material]
}

/** Every map a standard material may carry. Read off the object: a `Material` declares none. */
function texturesOf(material: Material): Texture[] {
  const found: Texture[] = []
  for (const value of Object.values(material)) {
    if (isTexture(value)) found.push(value)
  }
  return found
}

function isTexture(value: unknown): value is Texture {
  return typeof value === 'object' && value !== null && Reflect.get(value, 'isTexture') === true
}

function textureBytes(texture: Texture): number {
  const image: unknown = texture.image
  if (typeof image !== 'object' || image === null) return 0

  const width = Reflect.get(image, 'width')
  const height = Reflect.get(image, 'height')
  if (typeof width !== 'number' || typeof height !== 'number') return 0

  return width * height * BYTES_PER_TEXEL
}

/**
 * How tightly a mesh packs its triangles: triangles per unit of surface of the box around it.
 *
 * A box rather than the real surface — a real area means walking every triangle, which is the
 * work this number exists to avoid. It is a comparison between the objects of one scene, never
 * an absolute: what it answers is "which of these is the heavy one".
 */
export function densityOf(object: Object3D): number {
  const stats = statsOf([object])
  if (stats.triangles === 0) return 0

  const size = new Box3().setFromObject(object).getSize(new Vector3())
  const area = 2 * (size.x * size.y + size.y * size.z + size.z * size.x)
  // A flat plane and a point both enclose nothing; their triangles are all the answer there is.
  return area === 0 ? stats.triangles : stats.triangles / area
}

/** Adds up what several counts hold, for a scene read object by object. */
export function totalStats(parts: readonly SceneStats[]): SceneStats {
  return parts.reduce(
    (total, part) => ({
      triangles: total.triangles + part.triangles,
      vertices: total.vertices + part.vertices,
      draws: total.draws + part.draws,
      textureBytes: total.textureBytes + part.textureBytes,
    }),
    { ...EMPTY_STATS },
  )
}
