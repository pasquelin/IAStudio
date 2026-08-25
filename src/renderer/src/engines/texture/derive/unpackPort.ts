import type { PbrChannel } from '@shared/domain/texture'
import type { TextureSource } from '../../scene/textureCache'
import { encodePng, runOffscreenPass, type PictureSize } from './offscreen'
import { createUnpackPass } from './unpackShaders'

export type UnpackRequest = {
  /** The channel to read out. `sourceUrl` points at the picture packing it. */
  channel: PbrChannel
  sourceUrl: string
}

export type UnpackedPicture = PictureSize & {
  /** PNG: a channel taken out of a pack is data, and JPEG would invent gradients across it. */
  png: Uint8Array
}

/** Reading one channel out of a packed picture. A port for the reason `DerivePort` is one. */
export type UnpackPort = (request: UnpackRequest) => Promise<UnpackedPicture>

export function createUnpackPort({ loadTexture }: { loadTexture: TextureSource }): UnpackPort {
  return ({ channel, sourceUrl }) =>
    runOffscreenPass({
      load: loadTexture,
      urls: [sourceUrl],
      pass: ([source]) => ({ material: createUnpackPass(channel, source.texture) }),
      draw: async ({ renderer, pipeline, material, size }) => {
        pipeline.renderToScreen(material)
        return { ...size, png: await encodePng(renderer.domElement) }
      },
    })
}
