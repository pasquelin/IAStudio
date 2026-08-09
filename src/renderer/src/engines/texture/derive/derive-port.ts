import { LinearFilter, NoColorSpace, WebGLRenderer, type Material, type Texture } from 'three'
import { isRecord, readNumber } from '@shared/guards'
import type { PbrChannel } from '@shared/domain/texture'
import { createGpuPipeline } from '../../gpu/GpuPipeline'
import type { TextureSource } from '../../scene/texture-cache'
import { createDerivePass, type PictureSize } from './derive-shaders'

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
 * The GPU behind the port.
 *
 * It builds a renderer of its own rather than borrowing the viewport's — the exception
 * `GpuPipeline` names. Nothing is exchanged between the two contexts: the source is decoded
 * from the project's own file, and the result leaves as a PNG on its way to disk. Borrowing the
 * viewport's would mean drawing over the frame the user is looking at.
 *
 * One context per run, released before the promise settles. The ceiling it respects is not its
 * own: a browser keeps about sixteen contexts and evicts the oldest to hand out the next, so a
 * derivation that leaked one would black out a viewport somebody was looking at. What keeps two
 * runs from overlapping is the caller — every derivable menu row goes dead while one runs.
 */
export function createDerivePort({ loadTexture }: DerivePortOptions): DerivePort {
  return async ({ channel, sourceUrl }) => {
    const source = await loadTexture(sourceUrl)
    // Read as stored, whatever `contentOf` says the channel holds. A base colour decoded to
    // linear would have the pass compute on values the file never held, and write them back as
    // if it had — where the luminance of the stored picture is what the eye reads as depth.
    source.colorSpace = NoColorSpace
    // The frame is the source's own size, so every shader samples LOD 0 and nothing reads a mip.
    // Left on, three builds the whole pyramid: +22 MB and a full GPU pass on a 4K channel.
    source.generateMipmaps = false
    source.minFilter = LinearFilter

    // The whole of it in one `try`, opened the instant the pixels are ours. Sizing, building the
    // pass and asking for a context all throw — a machine whose GPU process has died throws on
    // the last one — and outside this block each of them pinned a fully decoded picture, 64 MB
    // for a 4K channel, for the life of the window.
    try {
      const size = sizeOf(source)
      const pass = createDerivePass(channel, source, size)
      try {
        return await draw(pass.material, size)
      } finally {
        pass.material.dispose()
      }
    } finally {
      source.dispose()
    }
  }
}

/** One context, one frame, one PNG — opened and given back inside this call, whatever happens. */
async function draw(material: Material, size: PictureSize): Promise<DerivedPicture> {
  const renderer = new WebGLRenderer({
    // Without it the drawing buffer is cleared before the canvas can be read back, and every
    // derivation comes out blank.
    preserveDrawingBuffer: true,
    // A full-screen quad depth-tests against nothing and blends with nothing. Left on, the
    // depth attachment alone is another 67 MB at 4K, allocated and thrown away.
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
      pipeline.renderToScreen(material)
      return { ...size, png: await encodePng(renderer.domElement) }
    } finally {
      pipeline.dispose()
    }
  } finally {
    renderer.dispose()
    // `dispose` frees three's own objects; the context itself only goes with this. And the one
    // that pays for a leak is not this call: a browser evicts the OLDEST context when it hands
    // out the seventeenth, so what goes black is a viewport somebody was looking at.
    renderer.forceContextLoss()
  }
}

/** What the loader decoded, in pixels. Anything else is a source there is nothing to read in. */
function sizeOf(source: Texture): PictureSize {
  const image: unknown = source.image
  if (!isRecord(image)) throw new Error('source decoded to nothing')

  const size = { width: readNumber(image, 'width', 0), height: readNumber(image, 'height', 0) }
  if (size.width <= 0 || size.height <= 0) throw new Error('source decoded to nothing')
  return size
}

/** The browser's own encoder — the one place where a per-pixel loop is not ours to write. */
async function encodePng(canvas: HTMLCanvasElement): Promise<Uint8Array> {
  const blob = await new Promise<Blob | null>(resolve => canvas.toBlob(resolve, 'image/png'))
  if (!blob) throw new Error('the canvas encoded to nothing')
  return new Uint8Array(await blob.arrayBuffer())
}
