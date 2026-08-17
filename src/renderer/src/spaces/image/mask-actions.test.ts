import { beforeEach, describe, expect, it } from 'vitest'
import { layerById } from '@/engines/canvas/canvasState'
import { installCanvas } from '@/stores/canvas-fixtures'
import { canvasOf, useCanvases } from '@/stores/canvases'
import { useCanvasViews } from '@/stores/canvas-views'
import { maskFromSelection } from './mask-actions'

const DOCUMENT = 'doc-1'

/** Which layers the engine was asked to paint a mask for. */
let filled: string[] = []
const host = { fillMaskFromSelection: (layerId: string) => filled.push(layerId) }

beforeEach(() => {
  filled = []
  installCanvas(DOCUMENT)
  useCanvasViews.setState({ selections: {} })
})

const active = () => {
  const canvas = canvasOf(useCanvases.getState(), DOCUMENT)
  return layerById(canvas, canvas.activeLayerId)
}

function select(): void {
  useCanvasViews
    .getState()
    .setSelection(DOCUMENT, { kind: 'rect', rect: { x: 0, y: 0, width: 50, height: 50 } })
}

describe('making a mask of the selection', () => {
  it('gives the armed layer a mask', () => {
    select()
    maskFromSelection(DOCUMENT, host)

    expect(active()?.mask).toEqual({ enabled: true, linked: true })
  })

  it('asks the engine to paint the region into it', () => {
    select()
    maskFromSelection(DOCUMENT, host)

    expect(filled).toEqual(['layer-1'])
  })

  // The mask is a command, so it undoes with the rest of the stack.
  it('is one history entry', () => {
    select()
    maskFromSelection(DOCUMENT, host)
    useCanvases.getState().undo(DOCUMENT)

    expect(active()?.mask).toBeUndefined()
  })

  it('does nothing at all when nothing is selected', () => {
    maskFromSelection(DOCUMENT, host)

    expect(active()?.mask).toBeUndefined()
    expect(filled).toEqual([])
  })
})
