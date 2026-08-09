import {
  Mesh,
  MeshStandardMaterial,
  NoColorSpace,
  RepeatWrapping,
  SRGBColorSpace,
  type BufferGeometry,
  type Texture,
} from 'three'
import type { MaterialRole } from '@shared/domain/texture-export'
import { exportObjects } from '../../scene/scene-export'
import type { TextureSource } from '../../scene/texture-cache'
import { previewGeometry } from '../preview-geometry'
import type { MaterialSettings, PreviewShape } from '../texture-state'

/**
 * A texture as one file an engine opens without being told anything.
 *
 * The four packed pictures go in as the material's own maps, and the settings the material
 * panel drives go in as the format's factors — a base colour tint, a roughness, an emissive
 * strength. Those are values a glTF holds natively, so writing them changes no pixel and the
 * file opens looking like the preview did, which is the whole promise of exporting what one
 * has been judging.
 *
 * The pictures are decoded again on the way in. `GLTFExporter` writes what a texture holds, and
 * what these hold is the PNG the packing pass just encoded — so the export cannot disagree with
 * the folder the other targets would have written.
 */

/** Colour where the picture is one, data everywhere else — the same rule the preview reads by. */
const COLOR_ROLES: readonly MaterialRole[] = ['baseColor', 'emissive']

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

  const geometry = previewGeometry(shape, material.heightScale > 0)
  const standard = buildMaterial(decoded, material)
  const mesh = new Mesh(geometry, standard)

  try {
    return await exportObjects([mesh], 'glb')
  } finally {
    // The copy `exportObjects` walks shares these, so nothing is freed before it has written.
    disposeAll(geometry, standard, decoded)
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
      placeTexture(texture, material, COLOR_ROLES.includes(role))
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
  // A fresh view over the bytes: `Blob` takes an ArrayBufferView, and handing it the buffer
  // itself would carry whatever else shares that buffer.
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
  material.displacementScale = settings.heightScale
  material.emissive.set(settings.emissive)
  material.emissiveIntensity = settings.emissiveIntensity

  return material
}

function disposeAll(
  geometry: BufferGeometry,
  material: MeshStandardMaterial,
  decoded: ReadonlyMap<MaterialRole, Texture>,
): void {
  for (const texture of decoded.values()) texture.dispose()
  material.dispose()
  geometry.dispose()
}
