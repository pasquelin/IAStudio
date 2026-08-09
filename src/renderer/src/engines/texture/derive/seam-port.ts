import type { TextureSource } from '../../scene/texture-cache'
import { runOffscreenPass } from './offscreen'
import { createSeamPass, SEAM_SCALE } from './seam-shader'

/**
 * How visible the wrap edge of a picture is, as a ratio against the picture's own grain — see
 * `seam-shader`. A port for the same reason the derivation is one: jsdom has no WebGL.
 */
export type SeamPort = (sourceUrl: string) => Promise<number>

export type SeamPortOptions = { loadTexture: TextureSource }

/** One texel of a one-by-one frame. The whole answer is reduced into it by the shader. */
const READBACK = { width: 1, height: 1 }

export function createSeamPort({ loadTexture }: SeamPortOptions): SeamPort {
  return sourceUrl =>
    runOffscreenPass({
      load: loadTexture,
      urls: [sourceUrl],
      pass: ([source]) => createSeamPass(source.texture, source.size),
      frame: () => READBACK,
      draw: ({ renderer, pipeline, material }) => {
        // Into a target rather than onto the canvas: a WebGL canvas has no 2D context to read
        // one pixel back from, and `readRenderTargetPixels` is the one door three offers.
        const target = pipeline.createTarget(READBACK.width, READBACK.height)
        try {
          pipeline.renderTo(material, target)
          const pixel = new Uint8Array(4)
          renderer.readRenderTargetPixels(target, 0, 0, 1, 1, pixel)
          return ((pixel[0] ?? 0) / 255) * SEAM_SCALE
        } finally {
          target.dispose()
        }
      },
    })
}
