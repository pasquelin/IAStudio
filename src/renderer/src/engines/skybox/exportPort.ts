import { SRGBColorSpace } from 'three'
import type { AdjustmentStack } from '@shared/domain/adjustments'
import type { TaskWatch } from '@shared/domain/taskProgress'
import { assetUrl, versionedUrl } from '@shared/domain/asset'
import { exportTargetOf } from '@shared/domain/exportRegistry'
import { faceFileNames } from '@shared/domain/skybox'
import type { ExportedFile } from '@shared/ipc'
import { createAdjustPass } from '../gpu/passes/adjust'
import { encodePng, runOffscreenPass, type PictureSize } from '../texture/derive/offscreen'
import type { TextureSource } from '../scene/textureCache'
import { createProjectionPass } from './projectionShader'

/**
 * A sky on its way to six files somebody will hand to an engine.
 *
 * A port for the same reason the texture's is: jsdom has no WebGL and no PNG encoder, so which
 * files, under which names, at which size is a test — and only what is below needs a GPU.
 *
 * What the viewport shows is not what leaves. The preview grades into a 2048×1024 target because
 * that is what the prefiltered environment is built from; an export grades at the source's own
 * resolution and samples THAT, so a 4K panorama does not reach a 2048 face through a reduction
 * it never had to go through.
 */

export type SkyboxExportRequest = {
  /** The equirectangular source, as the catalogue knows it. */
  assetId: string
  adjustments: AdjustmentStack
  /** What the files are named after, already cleaned of everything a name cannot hold. */
  name: string
  /** The side of each square face, in pixels. */
  size: number
}

/**
 * Six faces of a 4K sky is seconds of GPU and six PNG encodes, so the watch is not decoration.
 * Optional because the assistant's door asks for the same bytes without one — that door shows no
 * row and cannot be stopped, which is a gap rather than a decision.
 */
export type SkyboxExportPort = (
  request: SkyboxExportRequest,
  watch?: TaskWatch,
) => Promise<ExportedFile[]>

export type SkyboxExportPortOptions = {
  /** Injected for the same reason the renderer's is: jsdom decodes no image. */
  loadTexture: TextureSource
  /**
   * When the source was last written, as the viewport reads it. Absent asks for the bare URL —
   * which is where the browser keeps the picture an edit REPLACED, so an export run after a ⌘S
   * would write the six faces from the old panorama while the viewport shows the new one.
   */
  assetVersion?: (assetId: string) => string | undefined
}

export function createSkyboxExportPort({
  loadTexture,
  assetVersion,
}: SkyboxExportPortOptions): SkyboxExportPort {
  // `async`, so a stop already raised comes back as a rejection rather than as a synchronous
  // throw: the port promises a promise, and half its callers only ever look at one.
  return async ({ assetId, adjustments, name, size }, watch) => {
    // Before the source is even asked for: decoding a 4K panorama is the first long thing here,
    // and a stop pressed while it downloads must not be answered by six faces of it.
    watch?.signal?.throwIfAborted()

    // Filled while the sources are in hand: `draw` is handed the frame's size — one face — and
    // the graded picture in between is the source's, which nothing else carries across.
    let equirect: PictureSize = { width: 0, height: 0 }

    return runOffscreenPass({
      load: loadTexture,
      urls: [versionedUrl(assetUrl(assetId), assetVersion?.(assetId))],

      pass: sources => {
        const [source] = sources
        // `loadSource` reads every picture as stored, which is right for a PBR channel and wrong
        // for a sky: this one IS a colour. Left undecoded, the grading would work on sRGB
        // numbers and the pass would encode them a second time on the way out.
        source.texture.colorSpace = SRGBColorSpace
        source.texture.needsUpdate = true

        const adjust = createAdjustPass()
        adjust.setSource(source.texture)
        adjust.setAdjustments(adjustments)
        return adjust
      },

      frame: sources => {
        equirect = sources[0].size
        return { width: size, height: size }
      },

      draw: async ({ pipeline, renderer, material }) => {
        // Half-float, as the viewport's is: eight bits per channel bands on a sky gradient long
        // before it bands on a texture, and every face is sampled out of this one picture.
        const graded = pipeline.createTarget(equirect.width, equirect.height, 'float')
        try {
          pipeline.renderTo(material, graded)

          const projection = createProjectionPass()
          try {
            projection.setSource(graded.texture)
            // A square frame for a square face, so `single` letterboxes nothing.
            projection.setFrame(size, size)

            const faces = faceFileNames(name)
            const files: ExportedFile[] = []
            for (const face of faces) {
              // Between faces, which is where a stop can be honoured: one face is a single
              // draw and a read, and interrupting inside it would leave the canvas half read.
              watch?.signal?.throwIfAborted()
              projection.setLayout('single', face.face)
              pipeline.renderToScreen(projection.material)
              // Awaited before the next face is drawn: they share one canvas, and a read left
              // running would encode whichever face happened to be on it.
              const bytes = await encodePng(renderer.domElement)
              files.push({
                name: face.name,
                extension: exportTargetOf('sky.faces').extension,
                bytes,
              })
              watch?.onStep?.(files.length, faces.length)
            }
            return files
          } finally {
            projection.dispose()
          }
        } finally {
          // Its own `finally`, inside the pass's: the target is 64 MB at 4K, and a throw while
          // the six faces are drawn would otherwise leave it held for the life of the window.
          graded.dispose()
        }
      },
    })
  }
}
