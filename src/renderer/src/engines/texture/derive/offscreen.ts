import { LinearFilter, NoColorSpace, WebGLRenderer, type Texture } from 'three'
import { isRecord, readNumber } from '@shared/guards'
import { createGpuPipeline, type GpuPipeline } from '../../gpu/GpuPipeline'
import type { TextureSource } from '../../scene/texture-cache'

/**
 * The plumbing every off-screen pass over a channel shares: take the pixels, open a context,
 * give both back. Written once because the giving back is the part that is easy to get wrong —
 * a decoded 4K channel is 64 MB, and a context that leaks blacks out somebody's viewport.
 */

export type PictureSize = { width: number; height: number }

/** A picture ready to be sampled, and the size the frame drawn from it must have. */
export type Source = { texture: Texture; size: PictureSize }

/**
 * Reads the channel as stored, whatever `contentOf` says it holds. A base colour decoded to
 * linear would have a pass compute on values the file never held — where the luminance of the
 * stored picture is what the eye reads as depth, and as grain.
 */
export async function loadSource(load: TextureSource, url: string): Promise<Source> {
  const texture = await load(url)
  texture.colorSpace = NoColorSpace
  // Every pass samples LOD 0 only. Left on, three builds the whole pyramid: +22 MB and a full
  // GPU pass on a 4K channel, for levels nothing reads.
  texture.generateMipmaps = false
  texture.minFilter = LinearFilter

  try {
    return { texture, size: sizeOf(texture) }
  } catch (error) {
    // Freed here, and it has to be here: this is the one throw the caller cannot guard, because
    // it happens before it holds anything to guard. A decoded 4K channel is 64 MB.
    texture.dispose()
    throw error
  }
}

/** What the loader decoded, in pixels. Anything else is a source there is nothing to read in. */
function sizeOf(texture: Texture): PictureSize {
  const image: unknown = texture.image
  if (!isRecord(image)) throw new Error('source decoded to nothing')

  const size = { width: readNumber(image, 'width', 0), height: readNumber(image, 'height', 0) }
  if (size.width <= 0 || size.height <= 0) throw new Error('source decoded to nothing')
  return size
}

/**
 * One context, one frame, given back inside this call whatever happens.
 *
 * A context of its own rather than the viewport's — the exception `GpuPipeline` names: nothing
 * is exchanged between the two, the result leaves as a PNG or as a number. And the one that
 * pays for a leak is not this call: a browser evicts the OLDEST context when it hands out the
 * seventeenth, so what goes black is a viewport somebody was looking at.
 */
export async function withRenderer<T>(
  size: PictureSize,
  draw: (renderer: WebGLRenderer, pipeline: GpuPipeline) => Promise<T> | T,
): Promise<T> {
  const renderer = new WebGLRenderer({
    // Without it the drawing buffer is cleared before the canvas can be read back, and every
    // derivation comes out blank.
    preserveDrawingBuffer: true,
    // A full-screen quad depth-tests against nothing and blends with nothing. Left on, the depth
    // attachment alone is another 67 MB at 4K, allocated and thrown away.
    antialias: false,
    depth: false,
    stencil: false,
    alpha: false,
  })

  try {
    // `false` for the third: the canvas is read back, never laid out, so a style in CSS pixels
    // would only make a device pixel ratio disagree with the frame that was drawn.
    renderer.setSize(size.width, size.height, false)
    const pipeline = createGpuPipeline(renderer)
    try {
      return await draw(renderer, pipeline)
    } finally {
      pipeline.dispose()
    }
  } finally {
    renderer.dispose()
    // `dispose` frees three's own objects; the context itself only goes with this.
    renderer.forceContextLoss()
  }
}

/** The browser's own encoder — the one place where a per-pixel loop is not ours to write. */
export async function encodePng(canvas: HTMLCanvasElement): Promise<Uint8Array> {
  const blob = await new Promise<Blob | null>(resolve => canvas.toBlob(resolve, 'image/png'))
  if (!blob) throw new Error('the canvas encoded to nothing')
  return new Uint8Array(await blob.arrayBuffer())
}
