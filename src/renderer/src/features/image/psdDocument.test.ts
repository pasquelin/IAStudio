import { readPsd } from 'ag-psd'
import { describe, expect, it, vi } from 'vitest'
import { exportTargetOf, lossesExportingTo } from '@shared/domain/exportRegistry'
import {
  ORA_MERGED_PATH,
  type OraDocument,
  type OraGroup,
  type OraLayer,
  type OraNode,
} from '@shared/domain/openRaster'
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
      createImageData: (width: number, height: number) => ({
        data: new Uint8ClampedArray(width * height * 4),
        width,
        height,
      }),
      getImageData: () => ({
        // NOT zeros: the composite the writer is handed is read back below, and a field of zeros
        // is exactly what it writes when nobody hands it one.
        data: new Uint8ClampedArray(canvas.width * canvas.height * 4).fill(7),
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

const group = (
  name: string,
  children: readonly OraNode[],
  over: Partial<OraGroup> = {},
): OraGroup => ({
  kind: 'group',
  name,
  isolation: 'auto',
  children,
  x: 0,
  y: 0,
  opacity: 1,
  visible: true,
  composite: 'svg:src-over',
  ...over,
})

/** Every layer of the tree, however deep — a surface has to exist for each, or it is left out. */
function layersIn(nodes: readonly OraNode[]): OraLayer[] {
  return nodes.flatMap(node => (node.kind === 'group' ? layersIn(node.children) : [node]))
}

function documentOf(nodes: readonly OraNode[]): OraDocument {
  return {
    stack: { width: 2, height: 2, nodes, studio: '' },
    surfaces: [
      { path: ORA_MERGED_PATH, png: new Uint8Array([1, 2, 3]) },
      ...layersIn(nodes).map(one => ({ path: one.src, png: new Uint8Array([1, 2, 3]) })),
    ],
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

  /**
   * The three the writer puts on a layer, and the placement it cannot: a `left` and a `top`, over
   * pixels handed to it untransformed. `layerTransform` fires for a TURN, so a rotated layer
   * arrives square — it was listed as carried, and this is the case that would have said so.
   *
   * The registry is read HERE rather than beside itself: this is where the file comes back, and
   * the cases around it are what show each of the three surviving the trip.
   */
  it('carries what the registry promises of it, and no placement past the offset', async () => {
    const psd = await readBack(documentOf([layer('Ink', { x: 12, y: 34 })]))

    expect([psd.children?.[0]?.left, psd.children?.[0]?.top]).toEqual([12, 34])
    expect(exportTargetOf('picture.psd').capability.interchange).toEqual([
      'layers',
      'blendMode',
      'layerOpacity',
    ])
    expect(lossesExportingTo(['layerTransform', 'groups'], 'picture.psd')).toEqual([
      'layerTransform',
      'groups',
    ])
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

  /**
   * A stack NESTS — `oraStackOf` writes a group with its children inside it — and reading only the
   * top level dropped every layer of every group, with nothing said and the registry declaring the
   * opposite. Bottom first inside the group as well as outside it.
   */
  it('brings a group’s layers out as siblings rather than losing them', async () => {
    const psd = await readBack(
      documentOf([layer('Top'), group('Folder', [layer('Inner top'), layer('Inner bottom')])]),
    )

    expect(psd.children?.map(child => child.name)).toEqual(['Inner bottom', 'Inner top', 'Top'])
  })

  /** A group is gone, so what it held of its children has to ride down onto them. */
  it('folds a group’s own hiding and opacity onto what it held', async () => {
    const psd = await readBack(
      documentOf([
        group('Folder', [layer('Ink', { opacity: 0.5 })], { visible: false, opacity: 0.5 }),
      ]),
    )

    const [child] = psd.children ?? []
    expect(child?.hidden).toBe(true)
    expect(child?.opacity).toBeCloseTo(0.25, 2)
  })

  /**
   * `ag-psd` writes a field of zeros for the document's own composite when it is handed none, and
   * a reader that SHOWS that composite rather than re-compositing — Preview, Finder — draws black.
   */
  it('writes the flatten as the composite, not a field of zeros', async () => {
    const bytes = await psdBytesOf(documentOf([layer('Ink')]))

    const psd = readPsd(new Uint8Array(bytes).buffer, {
      useImageData: true,
      skipLayerImageData: true,
      skipThumbnail: true,
    })

    // The COLOUR bytes alone: a composite written as three channels reads back with an alpha of
    // 255 throughout, so looking at every byte is green on the very field of zeros this catches.
    expect(psd.imageData?.data.some((byte, at) => at % 4 !== 3 && byte !== 0)).toBe(true)
  })
})
