import { beforeEach, describe, expect, it } from 'vitest'
import { canvasOf, canvasHistoryOf, useCanvases } from '@/stores/canvases'
import { guidePort } from './guide-port'

const DOCUMENT = 'doc-1'

const guides = () => canvasOf(useCanvases.getState(), DOCUMENT).guides
const entries = () => canvasHistoryOf(useCanvases.getState(), DOCUMENT).past.length

describe('guidePort', () => {
  beforeEach(() => {
    useCanvases.setState({ states: {}, histories: {} })
  })

  it('lays a guide down where the drag started', () => {
    const port = guidePort(DOCUMENT)
    port.beginDrag()
    port.add('x', 120)

    expect(guides()).toEqual([expect.objectContaining({ axis: 'x', position: 120 })])
  })

  /**
   * The whole reason `addGuide` replaces instead of appending: pulling a guide off a ruler and
   * dropping it 300 px away is one thing the user did, and ⌘Z has to give all of it back at once.
   */
  it('keeps one history entry for the drag that created it', () => {
    const port = guidePort(DOCUMENT)
    port.beginDrag()
    const id = port.add('x', 120)
    port.move(id, 240)
    port.move(id, 300)
    port.endDrag()

    expect(entries()).toBe(1)
    expect(guides()).toEqual([{ id, axis: 'x', position: 300 }])

    useCanvases.getState().undo(DOCUMENT)
    expect(guides()).toEqual([])
  })

  it('leaves no trace when the new guide is dropped back on its ruler', () => {
    const port = guidePort(DOCUMENT)
    port.beginDrag()
    const id = port.add('y', 40)
    port.move(id, 8)
    port.remove(id)
    port.endDrag()

    expect(guides()).toEqual([])
    expect(entries()).toBe(0)
  })

  // Undoing the entry would have worked, but it leaves it in the redo stack: ⌘Y would then bring
  // back a guide the user had just thrown away, at the position it had when they let go.
  it('leaves nothing to redo after a guide is thrown away', () => {
    const port = guidePort(DOCUMENT)
    port.beginDrag()
    const id = port.add('y', 40)
    port.move(id, 8)
    port.remove(id)
    port.endDrag()

    expect(canvasHistoryOf(useCanvases.getState(), DOCUMENT).future).toEqual([])
    useCanvases.getState().redo(DOCUMENT)
    expect(guides()).toEqual([])
  })

  it('moves a guide from an earlier gesture in one entry of its own', () => {
    const first = guidePort(DOCUMENT)
    first.beginDrag()
    const id = first.add('x', 100)
    first.endDrag()

    const second = guidePort(DOCUMENT)
    second.beginDrag()
    second.move(id, 250)
    second.move(id, 260)
    second.endDrag()

    expect(entries()).toBe(2)
    expect(guides()).toEqual([{ id, axis: 'x', position: 260 }])

    useCanvases.getState().undo(DOCUMENT)
    expect(guides()).toEqual([{ id, axis: 'x', position: 100 }])
  })

  it('removes an existing guide as its own entry, which undo gives back', () => {
    const first = guidePort(DOCUMENT)
    first.beginDrag()
    const id = first.add('x', 100)
    first.endDrag()

    const second = guidePort(DOCUMENT)
    second.beginDrag()
    second.remove(id)
    second.endDrag()

    expect(guides()).toEqual([])
    useCanvases.getState().undo(DOCUMENT)
    expect(guides()).toEqual([{ id, axis: 'x', position: 100 }])
  })
})
