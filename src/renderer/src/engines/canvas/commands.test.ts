import { describe, expect, it } from 'vitest'
import { emptyHistory, run, undo } from '../core/history'
import {
  addLayer,
  removeLayer,
  renameLayer,
  reorderLayer,
  selectLayer,
  setLayerOpacity,
  setLayerVisible,
} from './commands'
import { layerFixture } from './canvas-fixtures'
import { DEFAULT_CANVAS, layerById, type CanvasState } from './canvas-state'

const second = layerFixture()

const withTwo: CanvasState = addLayer(second).apply(DEFAULT_CANVAS)

describe('addLayer', () => {
  it('stacks the layer on top and makes it active', () => {
    expect(withTwo.layers.at(-1)?.id).toBe('layer-2')
    expect(withTwo.activeLayerId).toBe('layer-2')
  })

  it('reverts to the stack without it', () => {
    const command = addLayer(second)
    expect(command.revert(command.apply(DEFAULT_CANVAS)).layers).toHaveLength(1)
  })
})

describe('removeLayer', () => {
  it('drops the layer', () => {
    expect(removeLayer('layer-2').apply(withTwo).layers).toHaveLength(1)
  })

  it('refuses to remove the last one, because a canvas needs something to paint on', () => {
    expect(removeLayer('layer-1').apply(DEFAULT_CANVAS)).toEqual(DEFAULT_CANVAS)
  })

  it('moves the selection to a neighbour rather than leaving it dangling', () => {
    const state = removeLayer('layer-2').apply(withTwo)
    expect(state.activeLayerId).toBe('layer-1')
  })

  it('puts the layer back at its original index', () => {
    const three = addLayer({ ...second, id: 'layer-3' }).apply(withTwo)
    const command = removeLayer('layer-2')
    const restored = command.revert(command.apply(three))
    expect(restored.layers.map(layer => layer.id)).toEqual(['layer-1', 'layer-2', 'layer-3'])
  })

  it('gives the selection back on undo', () => {
    const command = removeLayer('layer-2')
    expect(command.revert(command.apply(withTwo)).activeLayerId).toBe('layer-2')
  })
})

describe('reorderLayer', () => {
  it('moves a layer down the stack', () => {
    const state = reorderLayer('layer-2', 0).apply(withTwo)
    expect(state.layers.map(layer => layer.id)).toEqual(['layer-2', 'layer-1'])
  })

  it('puts the order back on revert', () => {
    const command = reorderLayer('layer-2', 0)
    const back = command.revert(command.apply(withTwo))
    expect(back.layers.map(layer => layer.id)).toEqual(['layer-1', 'layer-2'])
  })
})

describe('single-field edits', () => {
  it('sets and reverts opacity', () => {
    const command = setLayerOpacity('layer-2', 0.25)
    const applied = command.apply(withTwo)
    expect(layerById(applied, 'layer-2')?.opacity).toBe(0.25)
    expect(layerById(command.revert(applied), 'layer-2')?.opacity).toBe(1)
  })

  it('bounds an opacity out of range', () => {
    expect(layerById(setLayerOpacity('layer-2', 5).apply(withTwo), 'layer-2')?.opacity).toBe(1)
  })

  it('toggles visibility', () => {
    expect(layerById(setLayerVisible('layer-2', false).apply(withTwo), 'layer-2')?.visible).toBe(
      false,
    )
  })

  it('renames', () => {
    expect(layerById(renameLayer('layer-2', 'Sky').apply(withTwo), 'layer-2')?.name).toBe('Sky')
  })
})

describe('selectLayer', () => {
  it('selects without touching the stack', () => {
    expect(selectLayer(withTwo, 'layer-1').layers).toEqual(withTwo.layers)
    expect(selectLayer(withTwo, 'layer-1').activeLayerId).toBe('layer-1')
  })
})

describe('through the shared history', () => {
  it('undoes a rename back to the previous name', () => {
    const [applied, history] = run(withTwo, emptyHistory(), renameLayer('layer-2', 'Sky'))
    const [back] = undo(applied, history)
    expect(layerById(back, 'layer-2')?.name).toBe('Paint')
  })
})
