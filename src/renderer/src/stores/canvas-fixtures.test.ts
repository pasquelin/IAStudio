import { beforeEach, describe, expect, it } from 'vitest'
import { renameLayer } from '@/engines/canvas/commands'
import { layerFixture } from '@/engines/canvas/canvas-fixtures'
import { DEFAULT_CANVAS, type CanvasState } from '@/engines/canvas/canvas-state'
import { installCanvas, layerNow } from './canvas-fixtures'
import { useCanvases } from './canvases'

const DOCUMENT = 'image-1'

const canvasOfOne = (name: string): CanvasState => {
  const layer = layerFixture({ name })
  return { ...DEFAULT_CANVAS, layers: [layer], activeLayerId: layer.id }
}

describe('layerNow', () => {
  beforeEach(() => {
    installCanvas(DOCUMENT, canvasOfOne('Sky'))
  })

  /**
   * Two canvases have to stand at once for this to be observable: with one installed, reading the
   * wrong document falls back to the default canvas, whose layer carries neither name — and
   * `installCanvas` replaces the whole map, so both are set at once rather than installed in turn.
   */
  it('reads the document it is given, not one of its own', () => {
    useCanvases.setState({
      states: { [DOCUMENT]: canvasOfOne('Sky'), 'image-2': canvasOfOne('Sea') },
    })

    expect(layerNow('image-2', 'layer-2')?.name).toBe('Sea')
    expect(layerNow(DOCUMENT, 'layer-2')?.name).toBe('Sky')
  })

  /** What the suites branch on: `null`, never a throw, for a layer the canvas does not hold. */
  it('answers null for an id the canvas does not hold', () => {
    expect(layerNow(DOCUMENT, 'layer-404')).toBeNull()
  })

  /**
   * Where the scene's reader answers `null` for a lost document, this one answers a LAYER: the
   * store falls back to `DEFAULT_CANVAS`, which opens with `layer-1`. Suites lean on it — one
   * asserts an untouched position on a document nothing ever installed — so it is pinned rather
   * than left to be rediscovered as a surprise.
   *
   * And it answers it under `layer-1` ALONE: `layerFixture` hands out `layer-2`, so the id most
   * suites carry reads `null` on a lost document, indistinguishable from a layer that went
   * missing. An isolation assertion written on the second layer needs its own non-null guard.
   */
  it('answers the default canvas layer for a document the store does not hold', () => {
    expect(layerNow('image-404', 'layer-1')?.name).toBe('Background')
    expect(layerNow('image-404', 'layer-2')).toBeNull()
  })

  /** Read at call time: the suites call it after an edit and expect the edited value. */
  it('reads the store as it stands at the call, not as it stood before', () => {
    const before = layerNow(DOCUMENT, 'layer-2')

    useCanvases.getState().runCommand(DOCUMENT, renameLayer('layer-2', 'Sea'))

    expect(before?.name).toBe('Sky')
    expect(layerNow(DOCUMENT, 'layer-2')?.name).toBe('Sea')
  })
})
