import {
  Mesh,
  MeshStandardMaterial,
  NoColorSpace,
  RepeatWrapping,
  SRGBColorSpace,
  type Texture,
} from 'three'
import type { MaterialRole } from '@shared/domain/materialExport'
import { disposeTree } from '../../scene/modelCache'
import { exportObjects } from '../../scene/sceneExport'
import type { TextureSource } from '../../scene/textureCache'
import { previewGeometry } from '../previewGeometry'
import { contentOf } from '../materialState'
import type { MaterialSettings } from '@shared/domain/material'
import type { PreviewShape } from '../materialState'

/**
 * A texture as one file an engine opens without being told anything.
 *
 * The four packed pictures go in as the material's own maps, and the settings the material
 * panel drives go in as the format's factors — a base colour tint, a roughness, an emissive
 * strength. Those are values a glTF holds natively, so writing them changes no pixel and the
 * file opens looking like the preview did, which is the whole promise of exporting what one
 * has been judging.
 *
 * The pictures are decoded again on the way in: the packing pass answers in PNG, and a texture
 * is what `GLTFExporter` writes from. It is a round trip through an encoder for bytes this
 * target never writes to disk, and it is the one real waste on this path — kept because the
 * alternative, carrying an `ImageBitmap` out of the pass, splits what the pass answers in two.
 */

/**
 * Colour where the picture is one, data everywhere else. Asked of `contentOf` rather than listed
 * here: the list that names which channels carry colour has already been written once and has
 * already been got wrong once, when the emissive was left out of it and came out dark.
 *
 * `orm` is the one role that is not a channel, and it is data on all three of its components.
 */
function isColour(role: MaterialRole): boolean {
  return role !== 'orm' && contentOf(role) === 'color'
}

export type GlbRequest = {
  /** The packed pictures, by the slot each fills. */
  pictures: ReadonlyMap<MaterialRole, Uint8Array>
  material: MaterialSettings
  /** The shape the texture was being judged on: a file of what was on screen. */
  shape: PreviewShape
  load: TextureSource
}

export async function buildGlb({
  pictures,
  material,
  shape,
  load,
}: GlbRequest): Promise<Uint8Array> {
  const decoded = await decodePictures(pictures, load, material)

  // Never displaced, whatever the height slider says: glTF has no displacement outside an
  // extension, `buildMaterial` mounts no such map, and the subdivided form of a box is 196k
  // triangles — six megabytes of vertices for a relief the file cannot carry.
  const geometry = previewGeometry(shape, false)
  const mesh = new Mesh(geometry, buildMaterial(decoded, material))

  try {
    return await exportObjects([mesh], 'glb')
  } finally {
    // The copy `exportObjects` walks shares the geometry and the material, so nothing is freed
    // before it has written. Through the tree rather than by hand: an export that one day gains
    // a second node would otherwise leak it with nothing to say so.
    disposeTree(mesh)
  }
}

/**
 * Every picture decoded, or none of them.
 *
 * Object URLs rather than data ones: a 4K base colour is megabytes, and a data URL of it is a
 * string the whole of which is copied at every hop. Each is revoked as soon as the loader has
 * read it — a blob left registered pins its bytes for the life of the window.
 */
async function decodePictures(
  pictures: ReadonlyMap<MaterialRole, Uint8Array>,
  load: TextureSource,
  material: MaterialSettings,
): Promise<Map<MaterialRole, Texture>> {
  const decoded = new Map<MaterialRole, Texture>()

  try {
    for (const [role, bytes] of pictures) {
      const texture = await decodeOne(bytes, load)
      placeTexture(texture, material, isColour(role))
      decoded.set(role, texture)
    }
  } catch (error) {
    // One that failed leaves the ones that decoded with nobody holding them.
    for (const texture of decoded.values()) texture.dispose()
    throw error
  }

  return decoded
}

async function decodeOne(bytes: Uint8Array, load: TextureSource): Promise<Texture> {
  // `slice`, and it is the type that asks rather than tidiness: a `Uint8Array` may sit on a
  // `SharedArrayBuffer`, which `Blob` refuses. The copy is what gives it a buffer it accepts.
  const url = URL.createObjectURL(new Blob([bytes.slice()], { type: 'image/png' }))
  try {
    return await load(url)
  } finally {
    URL.revokeObjectURL(url)
  }
}

/**
 * The repeat the material was judged under, carried into the file — `KHR_texture_transform`,
 * which `GLTFExporter` writes for any texture whose transform is not the identity.
 *
 * The preview's own multiplier is not read here, and that is the point: judging a repeat and
 * choosing one are two acts, and only the chosen one belongs in a file.
 */
function placeTexture(texture: Texture, material: MaterialSettings, colour: boolean): void {
  texture.colorSpace = colour ? SRGBColorSpace : NoColorSpace
  texture.wrapS = RepeatWrapping
  texture.wrapT = RepeatWrapping
  // No pivot: `KHR_texture_transform` has no field for one and `GLTFExporter` never reads
  // `material.center`, so a rotation leaves turning around the uv origin where the preview turns
  // around the middle. Setting it here would only have looked like the fix.
  texture.repeat.set(material.tiling.x, material.tiling.y)
  texture.offset.set(material.offset.x, material.offset.y)
  texture.rotation = material.rotation
}

function buildMaterial(
  decoded: ReadonlyMap<MaterialRole, Texture>,
  settings: MaterialSettings,
): MeshStandardMaterial {
  const material = new MeshStandardMaterial()

  material.map = decoded.get('baseColor') ?? null
  material.normalMap = decoded.get('normal') ?? null
  material.emissiveMap = decoded.get('emissive') ?? null

  const orm = decoded.get('orm') ?? null
  // The same picture in all three, which is what the packing was for: glTF reads occlusion on
  // its red and metallic-roughness on its green and blue, and one texture fills both slots.
  material.aoMap = orm
  material.roughnessMap = orm
  material.metalnessMap = orm

  material.color.set(settings.color)
  material.roughness = settings.roughness
  material.metalness = settings.metalness
  material.aoMapIntensity = settings.aoIntensity
  // Signed on the x alone: glTF holds one scalar for it, and the green convention was settled
  // in the pixels — see the `greenFlipped` reconciliation in the domain.
  material.normalScale.set(settings.normalScale, settings.normalScale)
  material.emissive.set(settings.emissive)
  material.emissiveIntensity = settings.emissiveIntensity

  return material
}
