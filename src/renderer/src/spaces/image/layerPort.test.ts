import { describe, expect, it } from 'vitest'
import { layerNow } from '@/stores/canvas-fixtures'
import { canvasHistoryOf, useCanvases } from '@/stores/canvases'
import { layerPort } from './layerPort'

const DOCUMENT = 'doc-1'

const transform = (documentId = DOCUMENT) => layerNow(documentId, 'layer-1')?.transform
const entries = () => canvasHistoryOf(useCanvases.getState(), DOCUMENT).past.length

describe('layerPort', () => {
  it('writes the layer position into the document it was built for', () => {
    const port = layerPort(DOCUMENT)
    port.beginDrag()
    port.translate('layer-1', 40, -12)
    port.endDrag()

    expect(transform()).toMatchObject({ x: 40, y: -12 })
    expect(transform('doc-2')?.x).toBe(0)
  })

  /**
   * The whole reason `translateLayer` reports an absolute position: dragging a layer across the
   * canvas is one thing the user did, and ⌘Z has to give all of it back at once.
   */
  it('keeps one history entry for a drag, however many steps it emits', () => {
    const port = layerPort(DOCUMENT)
    port.beginDrag()
    for (const x of [10, 40, 90]) port.translate('layer-1', x, 0)
    port.endDrag()

    expect(entries()).toBe(1)
    useCanvases.getState().undo(DOCUMENT)
    expect(transform()).toMatchObject({ x: 0, y: 0 })
  })

  it('leaves two successive drags two entries', () => {
    const port = layerPort(DOCUMENT)
    for (const x of [40, 90]) {
      port.beginDrag()
      port.translate('layer-1', x, 0)
      port.endDrag()
    }

    expect(entries()).toBe(2)
  })
})
