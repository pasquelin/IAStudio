import { describe, expect, it } from 'vitest'
import { canvasOf, canvasHistoryOf, useCanvases } from './canvases'
import { canUndo, canRedo } from '@/engines/core/history'
import { addLayer, renameLayer } from '@/engines/canvas/commands'
import { layerFixture } from '@/engines/canvas/canvas-fixtures'
import { DEFAULT_CANVAS } from '@/engines/canvas/canvasState'
import { layerNow } from './canvas-fixtures'

const layer = layerFixture()

describe('canvases store', () => {
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
    expect(canUndo(canvasHistoryOf(useCanvases.getState(), 'doc-1'))).toBe(true)
    expect(canUndo(canvasHistoryOf(useCanvases.getState(), 'doc-2'))).toBe(false)
  })

  it('undoes and redoes within one document', () => {
    const { runCommand, undo, redo } = useCanvases.getState()
    runCommand('doc-1', addLayer(layer))

    undo('doc-1')
    expect(canvasOf(useCanvases.getState(), 'doc-1').layers).toHaveLength(1)
    expect(canRedo(canvasHistoryOf(useCanvases.getState(), 'doc-1'))).toBe(true)

    redo('doc-1')
    expect(canvasOf(useCanvases.getState(), 'doc-1').layers).toHaveLength(2)
  })

  it('keeps a rename out of the other documents', () => {
    const { runCommand } = useCanvases.getState()
    runCommand('doc-1', renameLayer('layer-1', 'Sky'))
    expect(layerNow('doc-1', 'layer-1')?.name).toBe('Sky')
    expect(layerNow('doc-2', 'layer-1')?.name).toBe('Background')
  })

  /**
   * The engine throws the oldest undo tiles away under memory pressure. Undo is sequential, so an
   * entry sitting behind a missing one is unreachable: leaving it would show a ⌘Z that does
   * nothing rather than one that has run out.
   */
  describe('forgetThrough', () => {
    it('drops the named entry and everything older than it', () => {
      const { runCommand, forgetThrough } = useCanvases.getState()
      runCommand('doc-1', renameLayer('layer-1', 'Sky'))
      runCommand('doc-1', addLayer(layer))
      runCommand('doc-1', renameLayer('layer-1', 'Sea'))

      forgetThrough('doc-1', `layer:add:${layer.id}`)

      expect(canvasHistoryOf(useCanvases.getState(), 'doc-1').past.map(entry => entry.id)).toEqual([
        'layer:rename:layer-1',
      ])
    })

    // Redo runs forwards, so a hole in the future cuts everything past it instead.
    it('cuts the redo stack at the entry rather than before it', () => {
      const { runCommand, undo, forgetThrough } = useCanvases.getState()
      runCommand('doc-1', renameLayer('layer-1', 'Sky'))
      runCommand('doc-1', addLayer(layer))
      undo('doc-1')
      undo('doc-1')

      forgetThrough('doc-1', `layer:add:${layer.id}`)

      expect(
        canvasHistoryOf(useCanvases.getState(), 'doc-1').future.map(entry => entry.id),
      ).toEqual(['layer:rename:layer-1'])
    })

    it('leaves a history that knows nothing of that entry alone', () => {
      const { runCommand, forgetThrough } = useCanvases.getState()
      runCommand('doc-1', renameLayer('layer-1', 'Sky'))

      forgetThrough('doc-1', 'pixels:gone')

      expect(canUndo(canvasHistoryOf(useCanvases.getState(), 'doc-1'))).toBe(true)
    })
  })

  it('forgets a canvas and its history when the document closes', () => {
    useCanvases.getState().runCommand('doc-1', addLayer(layer))
    useCanvases.getState().drop('doc-1')
    expect(useCanvases.getState().states['doc-1']).toBeUndefined()
    expect(useCanvases.getState().histories['doc-1']).toBeUndefined()
  })
})
