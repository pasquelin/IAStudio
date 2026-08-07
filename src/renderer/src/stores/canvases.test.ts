import { beforeEach, describe, expect, it } from 'vitest'
import { canvasOf, historyOf, useCanvases } from './canvases'
import { canUndo, canRedo } from '@/engines/core/history'
import { addLayer, renameLayer } from '@/engines/canvas/commands'
import { layerFixture } from '@/engines/canvas/canvas-fixtures'
import { DEFAULT_CANVAS, layerById } from '@/engines/canvas/canvas-state'

const layer = layerFixture()

describe('canvases store', () => {
  beforeEach(() => {
    useCanvases.setState({ states: {}, histories: {} })
  })

  it('gives a fresh document for one never opened', () => {
    expect(canvasOf(useCanvases.getState(), 'unknown')).toEqual(DEFAULT_CANVAS)
  })

  it('runs a command against the right document', () => {
    useCanvases.getState().runCommand('doc-1', addLayer(layer))
    expect(canvasOf(useCanvases.getState(), 'doc-1').layers).toHaveLength(2)
    expect(canvasOf(useCanvases.getState(), 'doc-2').layers).toHaveLength(1)
  })

  it('keeps one history per document', () => {
    useCanvases.getState().runCommand('doc-1', addLayer(layer))
    expect(canUndo(historyOf(useCanvases.getState(), 'doc-1'))).toBe(true)
    expect(canUndo(historyOf(useCanvases.getState(), 'doc-2'))).toBe(false)
  })

  it('undoes and redoes within one document', () => {
    const { runCommand, undo, redo } = useCanvases.getState()
    runCommand('doc-1', addLayer(layer))

    undo('doc-1')
    expect(canvasOf(useCanvases.getState(), 'doc-1').layers).toHaveLength(1)
    expect(canRedo(historyOf(useCanvases.getState(), 'doc-1'))).toBe(true)

    redo('doc-1')
    expect(canvasOf(useCanvases.getState(), 'doc-1').layers).toHaveLength(2)
  })

  it('keeps a rename out of the other documents', () => {
    const { runCommand } = useCanvases.getState()
    runCommand('doc-1', renameLayer('layer-1', 'Sky'))
    expect(layerById(canvasOf(useCanvases.getState(), 'doc-1'), 'layer-1')?.name).toBe('Sky')
    expect(layerById(canvasOf(useCanvases.getState(), 'doc-2'), 'layer-1')?.name).toBe('Background')
  })

  it('forgets a canvas and its history when the document closes', () => {
    useCanvases.getState().runCommand('doc-1', addLayer(layer))
    useCanvases.getState().drop('doc-1')
    expect(useCanvases.getState().states['doc-1']).toBeUndefined()
    expect(useCanvases.getState().histories['doc-1']).toBeUndefined()
  })
})
