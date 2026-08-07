import { beforeEach, describe, expect, it } from 'vitest'
import { canvasOf, historyOf, useCanvases } from './canvases'
import { canUndo, canRedo } from '@/engines/core/history'
import { addLayer, renameLayer } from '@/engines/canvas/commands'
import { DEFAULT_CANVAS, layerById, type Layer } from '@/engines/canvas/canvas-state'

const layer: Layer = {
  id: 'layer-2',
  name: 'Paint',
  visible: true,
  locked: false,
  opacity: 1,
  blend: 'normal',
}

describe('canvases store', () => {
  beforeEach(() => {
    useCanvases.setState({ canvases: {}, histories: {} })
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
    const { runCommand, undoCanvas, redoCanvas } = useCanvases.getState()
    runCommand('doc-1', addLayer(layer))

    undoCanvas('doc-1')
    expect(canvasOf(useCanvases.getState(), 'doc-1').layers).toHaveLength(1)
    expect(canRedo(historyOf(useCanvases.getState(), 'doc-1'))).toBe(true)

    redoCanvas('doc-1')
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
    useCanvases.getState().dropCanvas('doc-1')
    expect(useCanvases.getState().canvases['doc-1']).toBeUndefined()
    expect(useCanvases.getState().histories['doc-1']).toBeUndefined()
  })
})
