import { describe, expect, it } from 'vitest'
import { ORA_MERGED_PATH, type OraDocument } from '@shared/domain/openRaster'
import type { LayerPixels } from './CanvasEngine'
import {
  DEFAULT_CANVAS,
  adjustmentLayer,
  groupLayer,
  pixelLayer,
  type CanvasState,
  type Layer,
} from './canvasState'
import { canvasFromOra, canvasFromOraContent, oraStackOf, oraSurfacesOf } from './oraDocument'

const PNG = Uint8Array.from([137, 80, 78, 71])

const withLayers = (...layers: Layer[]): CanvasState => ({ ...DEFAULT_CANVAS, layers })

const pixelsOf = (...ids: string[]): LayerPixels[] =>
  ids.map(layerId => ({ layerId, mask: false, data: PNG }))

/** The two halves a save produces, as `capture` puts them together. */
const written = (state: CanvasState, pixels: readonly LayerPixels[] = []): OraDocument => {
  const surfaces = oraSurfacesOf(pixels, PNG)
  return { stack: oraStackOf(state, surfaces), surfaces }
}

describe('writing a document as OpenRaster', () => {
  it('writes the stack top first, which is the order the format reads it in', () => {
    const state = withLayers(pixelLayer('a', 'Bottom'), pixelLayer('b', 'Top'))

    expect(written(state, pixelsOf('a', 'b')).stack.nodes.map(node => node.name)).toEqual([
      'Top',
      'Bottom',
    ])
  })

  it('names each surface after the layer, so the bytes find their way back', () => {
    const document = written(withLayers(pixelLayer('a', 'A')), pixelsOf('a'))

    expect(document.stack.nodes[0]).toMatchObject({ kind: 'layer', src: 'data/p_a.png' })
    expect(document.surfaces).toContainEqual({ path: 'data/p_a.png', png: PNG })
  })

  /** Required by the spec, and what every other application draws of a `.ora`. */
  it('carries the flatten at the name the standard reserves for it', () => {
    expect(written(withLayers(pixelLayer('a', 'A')), pixelsOf('a')).surfaces).toContainEqual({
      path: ORA_MERGED_PATH,
      png: PNG,
    })
  })

  it('says a plain layer composites the way the format spells it', () => {
    const state = withLayers({ ...pixelLayer('a', 'A'), blend: 'multiply' })

    expect(written(state, pixelsOf('a')).stack.nodes[0]?.composite).toBe('svg:multiply')
    expect(written(withLayers(pixelLayer('b', 'B')), pixelsOf('b')).stack.nodes[0]?.composite).toBe(
      'svg:src-over',
    )
  })

  it('nests a group as the format nests one', () => {
    const state = withLayers(groupLayer('g', 'Sky', [pixelLayer('a', 'Cloud')]))
    const group = written(state, pixelsOf('a')).stack.nodes[0]

    expect(group).toMatchObject({ kind: 'group', name: 'Sky' })
    expect(group?.kind === 'group' && group.children[0]?.name).toBe('Cloud')
  })

  /**
   * An adjustment layer has no element in OpenRaster. Writing it as a plain layer would be a lie
   * another editor draws — the flatten already carries what it did, and the studio reads it back
   * from its own state.
   */
  it('leaves out of the stack what the format has no element for', () => {
    const state = withLayers(pixelLayer('a', 'A'), adjustmentLayer('x', 'Exposure', 'exposure'))

    expect(written(state, pixelsOf('a')).stack.nodes).toHaveLength(1)
  })

  it('carries a mask beside the stack rather than in it', () => {
    const state = withLayers({ ...pixelLayer('a', 'A'), mask: { enabled: true, linked: true } })
    const document = written(state, [
      { layerId: 'a', mask: false, data: PNG },
      { layerId: 'a', mask: true, data: PNG },
    ])

    expect(document.stack.nodes).toHaveLength(1)
    expect(document.surfaces).toContainEqual({ path: 'data/m_a.png', png: PNG })
  })

  /**
   * `pixelSnapshots` skips a layer whose surface the engine has not built yet — one added
   * seconds before ⌘S. Named in the stack with nothing behind it, the layer opens blank; left
   * out, it costs only itself, and `studio` still carries it.
   */
  it('leaves out a layer the engine has no pixels for, rather than naming it empty', () => {
    const state = withLayers(pixelLayer('a', 'A'), pixelLayer('fresh', 'Fresh'))

    const document = written(state, pixelsOf('a'))

    expect(document.stack.nodes.map(node => node.name)).toEqual(['A'])
    expect(JSON.parse(document.stack.studio).layers).toHaveLength(2)
  })

  /** One odd layer id must cost that layer's pixels, never the whole picture. */
  it('leaves out pixels whose id could not be a container entry', () => {
    const document = written(withLayers(pixelLayer('a/b', 'Odd')), [
      { layerId: 'a/b', mask: false, data: PNG },
    ])

    expect(document.stack.nodes).toEqual([])
    expect(document.surfaces).toEqual([{ path: ORA_MERGED_PATH, png: PNG }])
  })

  it('carries its own state, which is what makes the file reopen whole', () => {
    const document = written(withLayers(pixelLayer('a', 'A')), pixelsOf('a'))

    expect(JSON.parse(document.stack.studio)).toMatchObject({ width: DEFAULT_CANVAS.width })
  })
})

describe('reading an OpenRaster document back', () => {
  it('gives back the document it wrote, down to what the format cannot hold', () => {
    const state = withLayers(pixelLayer('a', 'A'), adjustmentLayer('x', 'Exposure', 'exposure'))
    const read = canvasFromOra(written(state, pixelsOf('a')))

    expect(read.state.layers.map(layer => layer.id)).toEqual(['a', 'x'])
    expect(read.pixels).toEqual(pixelsOf('a'))
  })

  it('gives back the mask pixels the container carried beside the stack', () => {
    const state = withLayers({ ...pixelLayer('a', 'A'), mask: { enabled: true, linked: true } })
    const read = canvasFromOra(
      written(state, [
        { layerId: 'a', mask: false, data: PNG },
        { layerId: 'a', mask: true, data: PNG },
      ]),
    )

    expect(read.pixels).toContainEqual({ layerId: 'a', mask: true, data: PNG })
  })

  /**
   * The case the open format exists for: a `.ora` from Krita holds no studio state, and opening
   * it must build a document from what the standard DOES carry rather than refuse the file.
   */
  it('builds a document from the standard alone when nothing of ours is in the file', () => {
    const foreign: OraDocument = {
      stack: {
        width: 800,
        height: 600,
        nodes: [
          {
            kind: 'layer',
            name: 'Ink',
            src: 'data/ink.png',
            x: 12,
            y: 4,
            opacity: 0.5,
            visible: false,
            composite: 'svg:multiply',
          },
        ],
        studio: '',
      },
      surfaces: [
        { path: ORA_MERGED_PATH, png: PNG },
        { path: 'data/ink.png', png: PNG },
      ],
    }

    const read = canvasFromOra(foreign)

    expect(read.state.width).toBe(800)
    expect(read.state.layers).toHaveLength(1)
    expect(read.state.layers[0]).toMatchObject({
      name: 'Ink',
      opacity: 0.5,
      visible: false,
      blend: 'multiply',
    })
    expect(read.state.layers[0]?.transform).toMatchObject({ x: 12, y: 4 })
    expect(read.pixels[0]?.data).toBe(PNG)
  })

  it('reads a foreign stack bottom first, undoing the order the format wrote', () => {
    const document = written(
      withLayers(pixelLayer('a', 'Bottom'), pixelLayer('b', 'Top')),
      pixelsOf('a', 'b'),
    )

    const read = canvasFromOra({ ...document, stack: { ...document.stack, studio: '' } })
    expect(read.state.layers.map(layer => layer.name)).toEqual(['Bottom', 'Top'])
  })

  /**
   * The document's own `content` is the stack as JSON — what the file layer hands back on an
   * open. A content nothing can parse opens an EMPTY document rather than throwing into a mount
   * effect that has nowhere to show it.
   */
  it('opens an empty document rather than throwing on a content it cannot read', () => {
    expect(canvasFromOraContent('not json at all', []).state.layers).toEqual([])
    expect(canvasFromOraContent('{"nothing":true}', []).state.layers).toEqual([])
  })

  it('reads a document back from its own content', () => {
    const document = written(withLayers(pixelLayer('a', 'A')), pixelsOf('a'))
    const read = canvasFromOraContent(JSON.stringify(document.stack), document.surfaces)

    expect(read.state.layers.map(layer => layer.id)).toEqual(['a'])
    expect(read.pixels).toEqual(pixelsOf('a'))
  })
})
