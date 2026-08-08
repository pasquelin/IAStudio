import { describe, expect, it } from 'vitest'
import { emptyHistory, run, undo } from '../core/history'
import type { Command } from '../core/history'
import {
  addGuide,
  addLayer,
  clearGuides,
  cropToRect,
  duplicateLayer,
  flatten,
  groupLayers,
  mergeDown,
  moveGuide,
  removeGuide,
  removeLayer,
  renameLayer,
  reorderLayer,
  resizeCanvas,
  resizeImage,
  selectLayer,
  setLayerOpacity,
  setLayerVisible,
  translateLayer,
  paintPixels,
  ungroupLayer,
} from './commands'
import { layerFixture } from './canvas-fixtures'
import {
  allLayers,
  DEFAULT_CANVAS,
  groupLayer,
  isGroup,
  layerById,
  pixelLayer,
  type CanvasState,
} from './canvas-state'

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

const stack = (...names: string[]): CanvasState => ({
  ...DEFAULT_CANVAS,
  layers: names.map(name => pixelLayer(name, name)),
  activeLayerId: names[0] ?? null,
})

const namesOf = (state: CanvasState): string[] => state.layers.map(layer => layer.id)

/** Counted rather than random, so a duplicated subtree reads the same on every run. */
function ids(): () => string {
  let next = 0
  return () => `copy-${(next += 1)}`
}

/** Runs a command and gives back both sides, so every test can check the undo too. */
function roundTrip(state: CanvasState, command: Command<CanvasState>): [CanvasState, CanvasState] {
  const applied = command.apply(state)
  return [applied, command.revert(applied)]
}

describe('groupLayers', () => {
  it('wraps the chosen layers where the topmost of them stood', () => {
    const [after] = roundTrip(stack('a', 'b', 'c'), groupLayers(['a', 'b'], 'g', 'Group'))

    expect(namesOf(after)).toEqual(['g', 'c'])
    expect(allLayers(after.layers).map(layer => layer.id)).toEqual(['g', 'a', 'b', 'c'])
  })

  it('keeps the group under what already covered it', () => {
    const [after] = roundTrip(stack('a', 'b', 'c'), groupLayers(['b', 'c'], 'g', 'Group'))

    expect(namesOf(after)).toEqual(['a', 'g'])
  })

  /**
   * A group holds no pixels, so `paintTarget` refuses it: arming one left the brush drawing
   * nothing at all, silently, which is the state `deserializeCanvas` refuses to even load.
   */
  it('arms the topmost layer it wrapped rather than the group itself', () => {
    const [after] = roundTrip(stack('a', 'b'), groupLayers(['a'], 'g', 'Group'))

    expect(after.activeLayerId).toBe('a')
  })

  it('reaches into a nested group for something to arm', () => {
    const nested = groupLayer('inner', 'Inner', [pixelLayer('deep', 'Deep')])
    const before: CanvasState = { ...DEFAULT_CANVAS, layers: [nested], activeLayerId: 'deep' }
    const [after] = roundTrip(before, groupLayers(['inner'], 'g', 'Group'))

    expect(after.activeLayerId).toBe('deep')
  })

  it('does nothing when no named layer is there', () => {
    const before = stack('a')
    const [after] = roundTrip(before, groupLayers(['missing'], 'g', 'Group'))

    expect(after).toBe(before)
  })

  it('puts the stack back on undo', () => {
    const before = stack('a', 'b', 'c')
    const [, reverted] = roundTrip(before, groupLayers(['a', 'b'], 'g', 'Group'))

    expect(reverted.layers).toEqual(before.layers)
    expect(reverted.activeLayerId).toBe(before.activeLayerId)
  })
})

describe('ungroupLayer', () => {
  it('leaves the children where the group stood', () => {
    const grouped = groupLayers(['a', 'b'], 'g', 'Group').apply(stack('a', 'b', 'c'))
    const [after] = roundTrip(grouped, ungroupLayer('g'))

    expect(namesOf(after)).toEqual(['a', 'b', 'c'])
  })

  it('leaves a layer that is not a group alone', () => {
    const before = stack('a', 'b')
    const [after] = roundTrip(before, ungroupLayer('a'))

    expect(after).toBe(before)
  })
})

describe('mergeDown', () => {
  it('keeps the lower layer, which is the texture the merge is composited into', () => {
    const [after] = roundTrip(stack('a', 'b', 'c'), mergeDown('b'))

    expect(namesOf(after)).toEqual(['a', 'c'])
    expect(after.activeLayerId).toBe('a')
  })

  // Nothing to merge into: the gesture is a no-op rather than a layer quietly lost.
  it('leaves the bottom layer alone', () => {
    const before = stack('a', 'b')
    const [after] = roundTrip(before, mergeDown('a'))

    expect(after).toBe(before)
  })
})

describe('flatten', () => {
  it('leaves one layer, armed', () => {
    const [after, reverted] = roundTrip(stack('a', 'b', 'c'), flatten('flat', 'Background'))

    expect(namesOf(after)).toEqual(['flat'])
    expect(after.activeLayerId).toBe('flat')
    expect(namesOf(reverted)).toEqual(['a', 'b', 'c'])
  })
})

describe('duplicateLayer', () => {
  it('drops the copy directly above its source and arms it', () => {
    const [after] = roundTrip(stack('a', 'b'), duplicateLayer('a', 'a-copy', 'a copy', ids()))

    expect(namesOf(after)).toEqual(['a', 'a-copy', 'b'])
    expect(after.activeLayerId).toBe('a-copy')
  })

  it('copies what the layer looked like, not just its name', () => {
    const before: CanvasState = {
      ...DEFAULT_CANVAS,
      layers: [{ ...pixelLayer('a', 'A'), opacity: 0.25, blend: 'multiply' }],
      activeLayerId: 'a',
    }
    const [after] = roundTrip(before, duplicateLayer('a', 'copy', 'A copy', ids()))
    const copy = layerById(after, 'copy')

    expect(copy?.opacity).toBe(0.25)
    expect(copy?.blend).toBe('multiply')
  })
})

/**
 * The distinction the whole model turns on: the canvas is a window onto layers that may be
 * larger than it. Changing the window is not resampling what is behind it.
 */
describe('resizeCanvas against resizeImage', () => {
  it('moves the frame without scaling anything', () => {
    const [after] = roundTrip(stack('a'), resizeCanvas(400, 300, { x: 10, y: 20 }))

    expect([after.width, after.height]).toEqual([400, 300])
    expect(layerById(after, 'a')?.transform.scaleX).toBe(1)
    expect(layerById(after, 'a')?.transform.x).toBe(10)
  })

  it('scales the layers with the frame', () => {
    const [after] = roundTrip({ ...stack('a'), width: 100, height: 100 }, resizeImage(200, 50))

    expect([after.width, after.height]).toEqual([200, 50])
    expect(layerById(after, 'a')?.transform.scaleX).toBe(2)
    expect(layerById(after, 'a')?.transform.scaleY).toBe(0.5)
  })

  it('refuses a frame with no surface rather than producing one', () => {
    const [after] = roundTrip(stack('a'), resizeCanvas(0, -5, { x: 0, y: 0 }))

    expect([after.width, after.height]).toEqual([1, 1])
  })

  it('gives the frame back on undo', () => {
    const before = { ...stack('a'), width: 100, height: 100 }
    const [, reverted] = roundTrip(before, resizeImage(200, 200))

    expect(reverted.layers).toEqual(before.layers)
  })
})

describe('cropToRect', () => {
  it('brings the frame onto the rectangle and slides the layers under it', () => {
    const [after] = roundTrip(stack('a'), cropToRect({ x: 30, y: 40, width: 100, height: 80 }))

    expect([after.width, after.height]).toEqual([100, 80])
    expect(layerById(after, 'a')?.transform.x).toBe(-30)
  })
})

/**
 * Grouping is what turned the stack into a tree, and every operation below used to read only its
 * root. Each of these reproduces a bug that shipped in the first cut of the model.
 */
describe('operating inside a group', () => {
  const nested = (): CanvasState =>
    groupLayers(['a', 'b'], 'g', 'Group').apply(stack('a', 'b', 'c'))

  it('removes a layer that sits inside a group', () => {
    const [after] = roundTrip(nested(), removeLayer('a'))

    expect(allLayers(after.layers).map(layer => layer.id)).toEqual(['g', 'b', 'c'])
  })

  it('duplicates a layer that sits inside a group, beside it', () => {
    const [after] = roundTrip(nested(), duplicateLayer('a', 'a-copy', 'a copy', ids()))

    expect(allLayers(after.layers).map(layer => layer.id)).toEqual(['g', 'a', 'a-copy', 'b', 'c'])
  })

  it('merges within the group rather than through its wall', () => {
    const [after] = roundTrip(nested(), mergeDown('b'))

    expect(allLayers(after.layers).map(layer => layer.id)).toEqual(['g', 'a', 'c'])
    expect(after.activeLayerId).toBe('a')
  })

  it('reorders within the group, never out of it', () => {
    const [after] = roundTrip(nested(), reorderLayer('a', 1))
    const group = layerById(after, 'g')

    expect(group && isGroup(group) ? group.children.map(child => child.id) : []).toEqual(['b', 'a'])
  })

  it('dissolves a group nested in another one', () => {
    const outer = groupLayers(['g', 'c'], 'outer', 'Outer').apply(nested())
    const [after] = roundTrip(outer, ungroupLayer('g'))

    expect(allLayers(after.layers).map(layer => layer.id)).toEqual(['outer', 'a', 'b', 'c'])
  })

  // A group carries its children, so walking into it shifts a nested layer once per level.
  it('moves a nested layer exactly as much as a top-level one', () => {
    const [after] = roundTrip(nested(), resizeCanvas(400, 300, { x: 10, y: 20 }))

    expect(layerById(after, 'a')?.transform.x).toBe(0)
    expect(layerById(after, 'g')?.transform.x).toBe(10)
    expect(layerById(after, 'c')?.transform.x).toBe(10)
  })

  it('scales a nested layer exactly as much as a top-level one', () => {
    const [after] = roundTrip({ ...nested(), width: 100, height: 100 }, resizeImage(200, 200))

    expect(layerById(after, 'a')?.transform.scaleX).toBe(1)
    expect(layerById(after, 'g')?.transform.scaleX).toBe(2)
  })

  it('gives every copied child an id of its own', () => {
    const [after] = roundTrip(nested(), duplicateLayer('g', 'g-copy', 'Group copy', ids()))
    const all = allLayers(after.layers).map(layer => layer.id)

    expect(new Set(all).size).toBe(all.length)
  })

  // The armed layer went with the group; leaving it pointing at nothing swallows every stroke.
  it('rearms a survivor when the removed group held what was armed', () => {
    const before = { ...nested(), activeLayerId: 'a' }
    const [after] = roundTrip(before, removeLayer('g'))

    expect(layerById(after, after.activeLayerId)).not.toBeNull()
  })

  // Counted across the tree: a root holding one group still holds every layer inside it.
  it('still deletes when the root is a single group', () => {
    const rooted = groupLayers(['a', 'b', 'c'], 'g', 'Group').apply(stack('a', 'b', 'c'))
    const [after] = roundTrip(rooted, removeLayer('a'))

    expect(allLayers(after.layers).map(layer => layer.id)).toEqual(['g', 'b', 'c'])
  })

  it('still refuses to take the last paintable layer', () => {
    const before = stack('a')
    const [after] = roundTrip(before, removeLayer('a'))

    expect(after.layers).toHaveLength(1)
  })
})

// The revert used to restore the layers and keep the new frame, and the test only read layers.
describe('undoing a frame change', () => {
  it('gives the frame back, not just the layers', () => {
    const before = { ...stack('a'), width: 100, height: 100 }
    const [, reverted] = roundTrip(before, resizeImage(400, 400))

    expect([reverted.width, reverted.height]).toEqual([100, 100])
  })

  it('gives the frame back after a crop too', () => {
    const before = { ...stack('a'), width: 100, height: 100 }
    const [after, reverted] = roundTrip(before, cropToRect({ x: 10, y: 10, width: 50, height: 50 }))

    expect([after.width, after.height]).toEqual([50, 50])
    expect([reverted.width, reverted.height]).toEqual([100, 100])
  })
})

const withGuides: CanvasState = {
  ...DEFAULT_CANVAS,
  guides: [
    { id: 'g1', axis: 'x', position: 100 },
    { id: 'g2', axis: 'y', position: 200 },
  ],
}

describe('guide commands', () => {
  it('lays a guide down and takes it back', () => {
    const [after, reverted] = roundTrip(
      DEFAULT_CANVAS,
      addGuide({ id: 'g1', axis: 'x', position: 40 }),
    )

    expect(after.guides).toHaveLength(1)
    expect(reverted.guides).toEqual([])
  })

  it('moves a guide and restores where it stood', () => {
    const [after, reverted] = roundTrip(withGuides, moveGuide('g1', 350))

    expect(after.guides[0]?.position).toBe(350)
    expect(reverted.guides[0]?.position).toBe(100)
  })

  it('puts a removed guide back at its own index, not on top', () => {
    const [after, reverted] = roundTrip(withGuides, removeGuide('g1'))

    expect(after.guides.map(guide => guide.id)).toEqual(['g2'])
    expect(reverted.guides.map(guide => guide.id)).toEqual(['g1', 'g2'])
  })

  it('clears every guide at once, and gives them all back', () => {
    const [after, reverted] = roundTrip(withGuides, clearGuides())

    expect(after.guides).toEqual([])
    expect(reverted.guides).toHaveLength(2)
  })

  // Two commands of the same drag coalesce, so the second one applies over the first's result.
  it('keeps the original position across a coalesced drag', () => {
    const first = moveGuide('g1', 150)
    const dragged = moveGuide('g1', 320).apply(first.apply(withGuides))

    expect(first.revert(dragged).guides[0]?.position).toBe(100)
  })
})

// The gesture that lays a guide down keeps emitting `addGuide`, which is why it replaces.
describe('addGuide, applied twice', () => {
  it('moves the guide it already laid rather than stacking another', () => {
    const first = addGuide({ id: 'g1', axis: 'x', position: 10 }).apply(DEFAULT_CANVAS)
    const second = addGuide({ id: 'g1', axis: 'x', position: 90 }).apply(first)

    expect(second.guides).toEqual([{ id: 'g1', axis: 'x', position: 90 }])
  })

  // Applied over a guide that already existed, the inverse is a move back — not a removal, which
  // would lose a guide the user had laid in an earlier gesture.
  it('puts the guide it replaced back where it was', () => {
    const laid = addGuide({ id: 'g1', axis: 'x', position: 10 }).apply(DEFAULT_CANVAS)
    const again = addGuide({ id: 'g1', axis: 'x', position: 400 })

    expect(again.revert(again.apply(laid)).guides).toEqual([{ id: 'g1', axis: 'x', position: 10 }])
  })
})

describe('translateLayer', () => {
  it('writes the layer position into the state the engine reads back', () => {
    const moved = translateLayer('layer-1', 40, -12).apply(DEFAULT_CANVAS)

    expect(layerById(moved, 'layer-1')?.transform).toMatchObject({ x: 40, y: -12 })
  })

  it('puts it back exactly where it started', () => {
    const command = translateLayer('layer-1', 40, -12)

    expect(command.revert(command.apply(DEFAULT_CANVAS))).toEqual(DEFAULT_CANVAS)
  })

  /**
   * A drag emits one of these per pointer move, all merged into one entry: the merge keeps the
   * first command's `revert` and the last one's `apply`, so a relative step would rewind a single
   * frame of the gesture instead of the whole of it.
   */
  it('is absolute, so the steps of one drag can be merged', () => {
    const first = translateLayer('layer-1', 10, 0)
    const last = translateLayer('layer-1', 90, 0)
    const dragged = last.apply(first.apply(DEFAULT_CANVAS))

    expect(layerById(dragged, 'layer-1')?.transform.x).toBe(90)
    expect(first.revert(dragged)).toEqual(DEFAULT_CANVAS)
  })

  it('leaves a stack that holds no such layer alone', () => {
    expect(translateLayer('nope', 40, 40).apply(DEFAULT_CANVAS)).toBe(DEFAULT_CANVAS)
  })
})

describe('paintPixels', () => {
  function port() {
    const calls: string[] = []
    return { calls, restore: (id: string, side: string) => (calls.push(`${id}:${side}`), true) }
  }

  // The layer already holds the "after" pixels when the entry is pushed.
  it('asks for nothing on the apply that pushes it', () => {
    const spy = port()
    paintPixels('p1', spy).apply(DEFAULT_CANVAS)

    expect(spy.calls).toEqual([])
  })

  it('paints the tiles from before the gesture back on undo, and the ones after on redo', () => {
    const spy = port()
    const command = paintPixels('p1', spy)
    command.apply(DEFAULT_CANVAS)
    command.revert(DEFAULT_CANVAS)
    command.apply(DEFAULT_CANVAS)

    expect(spy.calls).toEqual(['p1:before', 'p1:after'])
  })

  // The pixels are the engine's; nothing about a stroke belongs in the serialized document.
  it('leaves the state untouched', () => {
    const command = paintPixels('p1', port())

    expect(command.revert(DEFAULT_CANVAS)).toBe(DEFAULT_CANVAS)
  })
})
