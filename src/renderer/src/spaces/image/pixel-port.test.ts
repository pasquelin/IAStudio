import { describe, expect, it } from 'vitest'
import { canUndo, canRedo } from '@/engines/core/history'
import { renameLayer } from '@/engines/canvas/commands'
import type { PatchSide } from '@/engines/canvas/PixelPatches'
import { canvasHistoryOf, useCanvases } from '@/stores/canvases'
import { pixelPort } from './pixel-port'

const DOCUMENT = 'doc-1'

const history = () => canvasHistoryOf(useCanvases.getState(), DOCUMENT)

/** Stands in for the engine: it records what the history asked it to replay. */
function engine(present = true) {
  const calls: string[] = []
  return {
    calls,
    restorePixels: (patchId: string, side: PatchSide) => {
      calls.push(`${patchId}:${side}`)
      return present
    },
  }
}

describe('pixelPort', () => {
  it('turns a finished stroke into one history entry', () => {
    const port = pixelPort(DOCUMENT, () => engine())
    port.record('patch-1')

    expect(history().past.map(entry => entry.id)).toEqual(['pixels:patch-1'])
  })

  // The layer already holds the pixels the stroke left; only the undo has work to do.
  it('replays the tiles from before the stroke on undo, and the ones after on redo', () => {
    const host = engine()
    pixelPort(DOCUMENT, () => host).record('patch-1')
    expect(host.calls).toEqual([])

    useCanvases.getState().undo(DOCUMENT)
    useCanvases.getState().redo(DOCUMENT)

    expect(host.calls).toEqual(['patch-1:before', 'patch-1:after'])
  })

  /**
   * An undo can land after the engine that recorded the patch was replaced — a panel detached
   * into another window rebuilds it. Reading the host at call time is what keeps the entry
   * pointing at whoever holds the textures now.
   */
  it('asks whichever engine is current, not the one that was there when it was built', () => {
    let host = engine()
    const port = pixelPort(DOCUMENT, () => host)
    port.record('patch-1')

    const rebuilt = engine()
    host = rebuilt
    useCanvases.getState().undo(DOCUMENT)

    expect(rebuilt.calls).toEqual(['patch-1:before'])
  })

  it('survives an undo with no engine at all', () => {
    pixelPort(DOCUMENT, () => null).record('patch-1')

    expect(() => useCanvases.getState().undo(DOCUMENT)).not.toThrow()
  })

  describe('drop', () => {
    it('takes the entry out of the stack rather than leaving a ⌘Z that does nothing', () => {
      const port = pixelPort(DOCUMENT, () => engine())
      port.record('patch-1')

      port.drop('patch-1')

      expect(canUndo(history())).toBe(false)
    })

    it('takes everything the stack would have to step over to reach it', () => {
      const port = pixelPort(DOCUMENT, () => engine())
      port.record('patch-1')
      useCanvases.getState().runCommand(DOCUMENT, renameLayer('layer-1', 'Sky'))

      port.drop('patch-1')

      expect(history().past.map(entry => entry.id)).toEqual(['layer:rename:layer-1'])
      expect(canRedo(history())).toBe(false)
    })
  })
})
