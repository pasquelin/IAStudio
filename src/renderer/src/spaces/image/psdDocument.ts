import { writePsd, type Layer } from 'ag-psd'
import type { OraDocument } from '@shared/domain/openRaster'
import { psdBlendOf } from '@shared/domain/psdBlend'
import type { BlendMode } from '@shared/domain/canvasBlend'

/**
 * Composed HERE, unlike `.ora`: a PSD carries raw pixels, and only this side decodes a PNG.
 */

/** What the studio's stack calls a composite, back to a blend the table knows. */
const blendOf = (composite: string): BlendMode => {
  const name = composite.replace(/^svg:/, '')
  return name === 'src-over' ? 'normal' : (name as BlendMode)
}

async function bitmapOf(png: Uint8Array): Promise<ImageBitmap> {
  // `slice`, so the blob owns bytes nothing else is about to reuse: the snapshots come off one
  // shared read-back buffer, and a blob over it decodes whatever the next layer wrote.
  return createImageBitmap(new Blob([png.slice()], { type: 'image/png' }))
}

/** A layer's pixels on a canvas of their own, which is what `ag-psd` takes. */
function canvasOf(bitmap: ImageBitmap): HTMLCanvasElement {
  const canvas = document.createElement('canvas')
  canvas.width = bitmap.width
  canvas.height = bitmap.height

  const context = canvas.getContext('2d')
  if (!context) throw new Error('this window has no 2D context to compose a PSD with')
  context.drawImage(bitmap, 0, 0)
  bitmap.close()
  return canvas
}

/**
 * The bytes of a `.psd`. GROUPS flatten away: an `OraDocument` hands over a flat list already.
 */
export async function psdBytesOf({ stack, surfaces }: OraDocument): Promise<Uint8Array> {
  const byPath = new Map(surfaces.map(one => [one.path, one.png]))

  const children = []
  // BOTTOM first: an OpenRaster stack is written top first and Photoshop counts the other way.
  for (const node of [...stack.nodes].reverse()) {
    const png = node.kind === 'layer' ? byPath.get(node.src) : undefined
    if (!png) continue

    children.push({
      name: node.name,
      opacity: node.opacity,
      hidden: !node.visible,
      // The table answers a name of this very union; `shared/` spells it as text rather than
      // importing the package's type, which would tie the domain to the writer it feeds.
      blendMode: psdBlendOf(blendOf(node.composite)) as Layer['blendMode'],
      left: node.x,
      top: node.y,
      canvas: canvasOf(await bitmapOf(png)),
    })
  }

  return new Uint8Array(writePsd({ width: stack.width, height: stack.height, children }))
}
