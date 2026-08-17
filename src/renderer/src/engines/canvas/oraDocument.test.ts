import { describe, expect, it } from 'vitest'
import type { OraDocument } from '@shared/domain/openRaster'
import {
  DEFAULT_CANVAS,
  adjustmentLayer,
  groupLayer,
  pixelLayer,
  type CanvasState,
  type Layer,
} from './canvasState'
import { canvasFromOra, oraDocumentOf } from './oraDocument'

const PNG = 'iVBORw0KGgo='

const withLayers = (...layers: Layer[]): CanvasState => ({ ...DEFAULT_CANVAS, layers })

const pixelsOf = (...ids: string[]) => ids.map(layerId => ({ layerId, mask: false, data: PNG }))

describe('writing a document as OpenRaster', () => {
  it('writes the stack top first, which is the order the format reads it in', () => {
    const state = withLayers(pixelLayer('a', 'Bottom'), pixelLayer('b', 'Top'))

    expect(oraDocumentOf(state, pixelsOf('a', 'b'), PNG).nodes.map(node => node.name)).toEqual([
      'Top',
      'Bottom',
    ])
  })

  it('names each layer file after the layer, so the bytes find their way back', () => {
    const written = oraDocumentOf(withLayers(pixelLayer('a', 'A')), pixelsOf('a'), PNG)

    expect(written.nodes[0]).toMatchObject({ kind: 'layer', src: 'data/p_a.png', png: PNG })
  })

  it('says a plain layer composites the way the format spells it', () => {
    const state = withLayers({ ...pixelLayer('a', 'A'), blend: 'multiply' })

    expect(oraDocumentOf(state, pixelsOf('a'), PNG).nodes[0]?.composite).toBe('svg:multiply')
    expect(
      oraDocumentOf(withLayers(pixelLayer('b', 'B')), pixelsOf('b'), PNG).nodes[0]?.composite,
    ).toBe('svg:src-over')
  })

  it('nests a group as the format nests one', () => {
    const state = withLayers(groupLayer('g', 'Sky', [pixelLayer('a', 'Cloud')]))
    const group = oraDocumentOf(state, pixelsOf('a'), PNG).nodes[0]

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

    expect(oraDocumentOf(state, pixelsOf('a'), PNG).nodes).toHaveLength(1)
  })

  it('carries a mask beside the stack rather than in it', () => {
    const state = withLayers({ ...pixelLayer('a', 'A'), mask: { enabled: true, linked: true } })
    const written = oraDocumentOf(
      state,
      [
        { layerId: 'a', mask: false, data: PNG },
        { layerId: 'a', mask: true, data: PNG },
      ],
      PNG,
    )

    expect(written.nodes).toHaveLength(1)
    expect(written.extras).toEqual({ 'data/m_a.png': PNG })
  })

  it('carries its own state, which is what makes the file reopen whole', () => {
    const written = oraDocumentOf(withLayers(pixelLayer('a', 'A')), pixelsOf('a'), PNG)

    expect(JSON.parse(written.studio)).toMatchObject({ width: DEFAULT_CANVAS.width })
  })
})

describe('reading an OpenRaster document back', () => {
  it('gives back the document it wrote, down to what the format cannot hold', () => {
    const state = withLayers(pixelLayer('a', 'A'), adjustmentLayer('x', 'Exposure', 'exposure'))
    const read = canvasFromOra(oraDocumentOf(state, pixelsOf('a'), PNG))

    expect(read.state.layers.map(layer => layer.id)).toEqual(['a', 'x'])
    expect(read.pixels).toEqual(pixelsOf('a'))
  })

  it('gives back the mask pixels a group of extras carried', () => {
    const state = withLayers({ ...pixelLayer('a', 'A'), mask: { enabled: true, linked: true } })
    const read = canvasFromOra(
      oraDocumentOf(
        state,
        [
          { layerId: 'a', mask: false, data: PNG },
          { layerId: 'a', mask: true, data: PNG },
        ],
        PNG,
      ),
    )

    expect(read.pixels).toContainEqual({ layerId: 'a', mask: true, data: PNG })
  })

  /**
   * The case the open format exists for: a `.ora` from Krita holds no studio state, and opening
   * it must build a document from what the standard DOES carry rather than refuse the file.
   */
  it('builds a document from the standard alone when nothing of ours is in the file', () => {
    const foreign: OraDocument = {
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
          png: PNG,
        },
      ],
      merged: PNG,
      studio: '',
      extras: {},
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
    const foreign = oraDocumentOf(
      withLayers(pixelLayer('a', 'Bottom'), pixelLayer('b', 'Top')),
      pixelsOf('a', 'b'),
      PNG,
    )

    expect(canvasFromOra({ ...foreign, studio: '' }).state.layers.map(l => l.name)).toEqual([
      'Bottom',
      'Top',
    ])
  })
})
