import type { PbrChannel } from '@shared/domain/texture'
import type { TextureSource } from '../../scene/texture-cache'
import { createDerivePass } from './derive-shaders'
import { encodePng, loadSource, withRenderer, type PictureSize } from './offscreen'

export type DeriveRequest = {
  /** The channel to compute. Its source channel is what `sourceUrl` points at. */
  channel: PbrChannel
  sourceUrl: string
}

export type DerivedPicture = PictureSize & {
  /** PNG, because a channel is data before it is a picture and JPEG would invent gradients. */
  png: Uint8Array
}

/**
 * Computing one channel from another. A port because jsdom has no WebGL and no PNG encoder:
 * everything above this line is testable, and only the implementation below needs a GPU.
 */
export type DerivePort = (request: DeriveRequest) => Promise<DerivedPicture>

export type DerivePortOptions = {
  /** Injected for the same reason the renderer's is: jsdom decodes no image. */
  loadTexture: TextureSource
}

/**
 * The GPU behind the port. One context per run, released before the promise settles — see
 * `withRenderer` for why that matters more than it looks.
 *
 * What keeps two runs from overlapping is the caller: every derivable menu row goes dead while
 * one runs.
 */
export function createDerivePort({ loadTexture }: DerivePortOptions): DerivePort {
  return async ({ channel, sourceUrl }) => {
    const { texture, size } = await loadSource(loadTexture, sourceUrl)

    // The whole of it in one `try`, opened the instant the pixels are ours. Building the pass and
    // asking for a context both throw — a machine whose GPU process has died throws on the second
    // — and outside this block each of them pinned a fully decoded picture for the life of the
    // window, 64 MB for a 4K channel.
    try {
      const pass = createDerivePass(channel, texture, size)
      try {
        return await withRenderer(size, async (renderer, pipeline) => {
          pipeline.renderToScreen(pass.material)
          return { ...size, png: await encodePng(renderer.domElement) }
        })
      } finally {
        pass.material.dispose()
      }
    } finally {
      texture.dispose()
    }
  }
}
