import { assetUrl } from '@shared/domain/asset'
import {
  assetsOf,
  boundedSize,
  maxSizeOf,
  resolvePictures,
  type ExportChannels,
  type MaterialRole,
  type ResolvedPicture,
  type TextureExportTarget,
  writesOneFile,
} from '@shared/domain/textureExport'
import type { TextureSource } from '../../scene/textureCache'
import type { MaterialSettings } from '@shared/domain/texture'
import type { PreviewShape } from '../textureState'
import { encodePng, runOffscreenPass, type PictureSize, type Sources } from '../derive/offscreen'
import { createPackPass } from './packShader'
import { buildGlb } from './gltf'

/**
 * A texture on its way to a folder somebody will open in an engine.
 *
 * A port for the same reason the derivation is one: jsdom has no WebGL and no PNG encoder, so
 * everything above this line — which recipes, which files, which size — is a test, and only
 * what is below needs a GPU.
 */

/** One file the export writes. The extension travels with it: a `.glb` sits beside `.png`s. */
export type ExportedFile = {
  /** Without extension, and already safe to be a file name — see `safeFileName`. */
  name: string
  extension: string
  bytes: Uint8Array
}

export type TexturePackRequest = {
  target: TextureExportTarget
  channels: ExportChannels
  /** What the files are named after, already cleaned of everything a name cannot hold. */
  name: string
  /**
   * What the material panel is set to. Read only by the glTF target, which has a field for each
   * of them — the four that write a folder write pixels, and a factor is not one.
   */
  material: MaterialSettings
  /** The shape the texture is being judged on, which is the shape the `.glb` carries. */
  shape: PreviewShape
}

export type TextureExportPort = (request: TexturePackRequest) => Promise<ExportedFile[]>

export type TextureExportPortOptions = {
  /** Injected for the same reason the renderer's is: jsdom decodes no image. */
  loadTexture: TextureSource
}

const PNG_EXTENSION = '.png'
const GLB_EXTENSION = '.glb'

/**
 * The size a packed picture comes out at: the largest source it reads, held under whatever the
 * target accepts.
 *
 * The largest by area rather than the widest and the tallest taken apart — those two, on a
 * 2048×512 channel packed with a 512×2048 one, would answer 2048×2048 and stretch both. A
 * texture that no longer matches the uv it was authored against is worse than a smaller one.
 */
function frameFor(sources: Sources, max: number | null): PictureSize {
  let largest = sources[0].size
  for (const source of sources) {
    if (source.size.width * source.size.height > largest.width * largest.height) {
      largest = source.size
    }
  }

  return boundedSize(largest, max)
}

/** One picture, drawn and encoded. Its own context, one at a time — `runOffscreenPass` holds both. */
function drawPicture(
  loadTexture: TextureSource,
  picture: ResolvedPicture,
  max: number | null,
): Promise<Uint8Array> {
  return runOffscreenPass({
    load: loadTexture,
    urls: assetsOf(picture).map(assetUrl),
    // In order rather than by lookup: `runOffscreenPass` answers in the order it was asked, and
    // the pass names its samplers by that same order.
    pass: sources =>
      createPackPass(
        picture,
        sources.map(source => source.texture),
      ),
    frame: sources => frameFor(sources, max),
    draw: async ({ renderer, pipeline, material }) => {
      pipeline.renderToScreen(material)
      return encodePng(renderer.domElement)
    },
  })
}

/**
 * Every channel at the size it was stored, whatever the viewport shows.
 *
 * The preview draws into a frame of a few hundred pixels; nothing here reads that. A pass is
 * built on the source's own decoded size, so an export is at full resolution by construction
 * rather than by a setting somebody has to remember — the one ceiling is a target's own.
 */
export function createTextureExportPort({
  loadTexture,
}: TextureExportPortOptions): TextureExportPort {
  return async ({ target, channels, name, material, shape }) => {
    const pictures = resolvePictures(target, channels, name)
    // Before the glTF road as much as the folder one: a texture with no channel resolves to no
    // picture, and `buildGlb` would happily answer a grey sphere wearing nothing — the one
    // target that would have opened a dialog to write a file saying nothing.
    if (pictures.length === 0) return []

    const max = maxSizeOf(target)

    const drawn: { picture: ResolvedPicture; bytes: Uint8Array }[] = []
    for (const picture of pictures) {
      // One after another rather than at once: each opens a WebGL context of its own, and
      // `runOffscreenPass` would serialize them anyway — asked for together they would only
      // hold every decoded channel of every picture in memory at the same time.
      drawn.push({ picture, bytes: await drawPicture(loadTexture, picture, max) })
    }

    if (!writesOneFile(target)) {
      return drawn.map(({ picture, bytes }) => ({
        name: picture.name,
        extension: PNG_EXTENSION,
        bytes,
      }))
    }

    const pictureByRole = new Map<MaterialRole, Uint8Array>()
    for (const { picture, bytes } of drawn) if (picture.role) pictureByRole.set(picture.role, bytes)

    const glb = await buildGlb({ pictures: pictureByRole, material, shape, load: loadTexture })
    return [{ name, extension: GLB_EXTENSION, bytes: glb }]
  }
}
