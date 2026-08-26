import type { Texture, WebGLRenderer, WebGLRenderTarget } from 'three'
import { isNeutral, type AdjustmentStack } from '@shared/domain/adjustments'
import { isRecord } from '@shared/guards'
import { createGpuPipeline } from './gpuPipeline'
import { createAdjustPass } from './passes/adjust'

export type SkyGrading = {
  /**
   * The picture as the document grades it, kept on the GPU.
   *
   * The SOURCE itself when nothing is graded, which is the common case: no target is allocated
   * and no pass is drawn for a sky nobody has touched.
   */
  of: (source: Texture | null, stack: AdjustmentStack) => Texture | null
  dispose: () => void
}

/**
 * Working width of the graded picture. Half-float RGBA is 8 bytes a pixel, so this target is
 * 16 MB and a 4096-wide source would be 67 — the same cap the sky's own viewport takes.
 */
const MAX_WIDTH = 2048

/**
 * Colour grading a sky, into a target a viewport reads for both its backdrop and its prefiltered
 * map. It takes the viewport's renderer rather than making one: what stays on the GPU cannot
 * cross two contexts — see `gpuPipeline`.
 */
export function createSkyGrading(renderer: WebGLRenderer): SkyGrading {
  const pipeline = createGpuPipeline(renderer)
  const adjust = createAdjustPass()
  let target: WebGLRenderTarget | null = null

  const targetOf = (width: number, height: number): WebGLRenderTarget => {
    if (target?.width === width && target.height === height) return target

    target?.dispose()
    // Half-float, not bytes: this feeds the prefiltered map, and eight bits a channel bands on a
    // sky gradient long before it bands on a texture.
    target = pipeline.createTarget(width, height, 'float')
    return target
  }

  return {
    of: (source, stack) => {
      if (!source || isNeutral(stack)) return source

      const width = Math.min(sizeOf(source), MAX_WIDTH)
      const held = targetOf(width, Math.max(1, Math.round(width / 2)))
      adjust.setSource(source)
      adjust.setAdjustments(stack)
      pipeline.renderTo(adjust.material, held)
      return held.texture
    },

    dispose: () => {
      target?.dispose()
      target = null
      adjust.dispose()
      pipeline.dispose()
    },
  }
}

/** A source with no measurable image — a stand-in, a test double — grades at the working size. */
function sizeOf(source: Texture): number {
  const image: unknown = source.image
  const width = isRecord(image) ? image.width : undefined
  return typeof width === 'number' && width > 0 ? width : MAX_WIDTH
}
