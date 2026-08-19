import { readPsd } from 'ag-psd'
import { describe, expect, it, vi } from 'vitest'
import type { OraDocument, OraLayer, OraNode } from '@shared/domain/openRaster'
import { psdBytesOf } from './psdDocument'

/**
 * jsdom decodes no PNG and draws on no canvas, so the two browser calls the composer makes are
 * stood in for. What is readable from here is what it DECIDES — which layers, in which order,
 * under which names, opacities and blends — which is the whole of the mapping.
 */
vi.stubGlobal('createImageBitmap', () =>
  Promise.resolve({ width: 2, height: 2, close: () => {} } as unknown as ImageBitmap),
)

/** jsdom's canvas has no 2D context at all, and the writer reads pixels back off one. */
vi.spyOn(document, 'createElement').mockImplementation(() => {
  const canvas = {
    width: 0,
    height: 0,
    getContext: () => ({
      drawImage: () => {},
      getImageData: () => ({
        data: new Uint8ClampedArray(canvas.width * canvas.height * 4),
        width: canvas.width,
        height: canvas.height,
      }),
    }),
  }
  // `as`: the writer reads four fields off a canvas, and those four are the ones above.
  return canvas as unknown as HTMLCanvasElement
})

const layer = (name: string, over: Partial<OraLayer> = {}): OraLayer => ({
  kind: 'layer',
  name,
  src: `data/${name}.png`,
  x: 0,
  y: 0,
  opacity: 1,
  visible: true,
  composite: 'svg:src-over',
  ...over,
})

function documentOf(nodes: readonly OraNode[]): OraDocument {
  return {
    stack: { width: 2, height: 2, nodes, studio: '' },
    surfaces: nodes.map(node => ({
      path: node.kind === 'layer' ? node.src : '',
      png: new Uint8Array([1, 2, 3]),
    })),
  }
}

/** Read back with the very library that wrote it, which is the only reader either side has. */
const readBack = async (document: OraDocument) =>
  readPsd(new Uint8Array(await psdBytesOf(document)).buffer, {
    skipLayerImageData: true,
    skipCompositeImageData: true,
    skipThumbnail: true,
  })

describe('an image document as Photoshop holds it', () => {
  it('writes the canvas at the size the stack declares', async () => {
    const psd = await readBack(documentOf([layer('Ink')]))

    expect(psd.width).toBe(2)
    expect(psd.height).toBe(2)
  })

  /** OpenRaster writes a stack top first and Photoshop counts the other way. */
  it('turns the stack the right way up', async () => {
    const psd = await readBack(documentOf([layer('Top'), layer('Bottom')]))

    expect(psd.children?.map(child => child.name)).toEqual(['Bottom', 'Top'])
  })

  it('carries the name, the opacity and what is hidden', async () => {
    const psd = await readBack(
      documentOf([layer('Ink', { opacity: 0.25, visible: false, name: 'Ink' })]),
    )

    const [child] = psd.children ?? []
    expect(child?.name).toBe('Ink')
    expect(child?.opacity).toBeCloseTo(0.25, 2)
    expect(child?.hidden).toBe(true)
  })

  it('spells the blend the way Photoshop does', async () => {
    const psd = await readBack(documentOf([layer('Ink', { composite: 'svg:color-dodge' })]))

    expect(psd.children?.[0]?.blendMode).toBe('color dodge')
  })

  /** `svg:src-over` is OpenRaster's plain layer, and Photoshop's word for it is another. */
  it('reads the plain composite as the plain blend', async () => {
    const psd = await readBack(documentOf([layer('Ink')]))

    expect(psd.children?.[0]?.blendMode).toBe('normal')
  })

  /**
   * A layer whose surface never made it into the container — one added seconds before the export,
   * whose texture the engine has not built. Left out rather than written empty.
   */
  it('leaves out a layer no surface backs', async () => {
    const psd = await readBack({
      stack: { width: 2, height: 2, nodes: [layer('Ink'), layer('Ghost')], studio: '' },
      surfaces: [{ path: 'data/Ink.png', png: new Uint8Array([1]) }],
    })

    expect(psd.children?.map(child => child.name)).toEqual(['Ink'])
  })
})
