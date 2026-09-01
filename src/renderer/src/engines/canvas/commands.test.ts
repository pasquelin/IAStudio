import { describe, expect, it } from 'vitest'
import { NEUTRAL_ADJUSTMENTS } from '@shared/domain/adjustments'
import { emptyHistory, run, undo } from '../core/history'
import type { Command } from '../core/history'
import {
  addGuide,
  addLayer,
  clearGuides,
  cropToRect,
  duplicateLayer,
  flatten,
  flipImage,
  groupLayers,
  mergeDown,
  moveGuide,
  moveLayer,
  removeGuide,
  removeLayer,
  rotateImage,
  renameLayer,
  resizeCanvas,
  setPixelCell,
  resizeImage,
  selectLayer,
  setLayerAdjustment,
  setLayerBlend,
  setLayerOpacity,
  resizeCaption,
  setLayerText,
  setLayerVisible,
  translateLayer,
  paintPixels,
  ungroupLayer,
} from './commands'
import { layerFixture } from './canvas-fixtures'
import {
  adjustmentLayer,
  allLayers,
  DEFAULT_CANVAS,
  groupLayer,
  IDENTITY,
  isGroup,
  layerById,
  pixelLayer,
  textLayer,
  type CanvasState,
  type Rect,
  type Transform,
} from './canvasState'
import type { Size } from '../core/geometry'
import { applyTo, layerMatrix, mapRect } from './layerSpace'

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

  /**
   * A group carries its subtree out with it, so counting the document's paintable layers is not
   * the question — what stays is. A folder holding every pixel layer answers "two paintable" and
   * empties the stack, which `deserializeCanvas` reads back as a blank default: the size, the
   * colour mode and the bit depth of the picture go with it.
   */
  it('refuses a group that would take everything paintable with it', () => {
    const folded = groupLayers(['layer-1', 'layer-2'], 'g', 'Group').apply(withTwo)

    expect(removeLayer('g').apply(folded)).toBe(folded)
  })

  it('removes a group the stack can do without', () => {
    const three = addLayer(layerFixture({ id: 'layer-3' })).apply(withTwo)
    const folded = groupLayers(['layer-1'], 'g', 'Group').apply(three)

    expect(allLayers(removeLayer('g').apply(folded).layers).map(layer => layer.id)).toEqual([
      'layer-2',
      'layer-3',
    ])
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

describe('moveLayer', () => {
  it('moves a layer down the stack', () => {
    const state = moveLayer('layer-2', null, 0).apply(withTwo)
    expect(state.layers.map(layer => layer.id)).toEqual(['layer-2', 'layer-1'])
  })

  it('puts the order back on revert', () => {
    const command = moveLayer('layer-2', null, 0)
    const back = command.revert(command.apply(withTwo))
    expect(back.layers.map(layer => layer.id)).toEqual(['layer-1', 'layer-2'])
  })

  // A negative index is the case that bites: `splice` would count it from the end of the stack.
  it('holds an index outside the stack at its edges', () => {
    const withThree = addLayer(layerFixture({ id: 'layer-3' })).apply(withTwo)

    expect(
      moveLayer('layer-1', null, -1)
        .apply(withThree)
        .layers.map(layer => layer.id),
    ).toEqual(['layer-1', 'layer-2', 'layer-3'])
    expect(
      moveLayer('layer-1', null, 99)
        .apply(withThree)
        .layers.map(layer => layer.id),
    ).toEqual(['layer-2', 'layer-3', 'layer-1'])
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

const childrenOf = (state: CanvasState, id: string): string[] => {
  const group = layerById(state, id)
  return group && isGroup(group) ? group.children.map(child => child.id) : []
}

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
describe('setPixelCell', () => {
  it('puts the document on a grid and takes it back off', () => {
    const [onAGrid] = roundTrip(DEFAULT_CANVAS, setPixelCell(16))

    expect(onAGrid.pixelCell).toBe(16)
    expect(setPixelCell(null).apply(onAGrid).pixelCell).toBeNull()
  })

  // A number field writes on every blur, and each of those would be a ⌘Z that does nothing.
  it('costs no undo entry when the grid is already what is asked for', () => {
    const onAGrid = setPixelCell(16).apply(DEFAULT_CANVAS)
    const [, history] = run(onAGrid, emptyHistory(), setPixelCell(16))

    expect(history.past).toEqual([])
  })

  /**
   * `Math.max(1, NaN)` is `NaN`, and `JSON.stringify` writes that as `null`: the session
   * would paint nothing while the file reopened clean, with nothing said anywhere.
   */
  it('reads a cell no document can hold as no grid at all', () => {
    expect(setPixelCell(Number.NaN).apply(DEFAULT_CANVAS).pixelCell).toBeNull()
    expect(setPixelCell(Number.POSITIVE_INFINITY).apply(DEFAULT_CANVAS).pixelCell).toBeNull()
    expect(setPixelCell(0).apply(DEFAULT_CANVAS).pixelCell).toBeNull()
    expect(setPixelCell(1e308).apply(DEFAULT_CANVAS).pixelCell).toBe(8192)
  })
})

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

  /**
   * The pixels are carried over unscaled into the bigger surface, so they still occupy the OLD
   * 100 × 100 region of it — and a resample has to land that region on the whole new frame.
   * Scaling `x` alone left it at half the document away, and asserting the factors alone could
   * not see it.
   */
  it('lands the pixels on the frame they were resampled onto', () => {
    const before = { ...stack('a'), width: 100, height: 100 }
    const [after] = roundTrip(before, resizeImage(200, 200))
    const transform = layerById(after, 'a')?.transform
    if (!transform) throw new Error('the fixture has no layer')
    const matrix = layerMatrix(transform, { width: after.width, height: after.height })

    expect(applyTo(matrix, { x: 0, y: 0 })).toMatchObject({
      x: expect.closeTo(0, 6),
      y: expect.closeTo(0, 6),
    })
    expect(applyTo(matrix, { x: 100, y: 100 })).toMatchObject({
      x: expect.closeTo(200, 6),
      y: expect.closeTo(200, 6),
    })
  })

  it('carries a displaced layer to the place the resample sends it', () => {
    const before = {
      ...stack('a'),
      width: 100,
      height: 100,
      layers: [{ ...pixelLayer('a', 'A'), transform: { ...IDENTITY, x: 10, y: 20 } }],
    }
    const [after] = roundTrip(before, resizeImage(200, 200))
    const transform = layerById(after, 'a')?.transform
    if (!transform) throw new Error('the fixture has no layer')

    expect(
      applyTo(layerMatrix(transform, { width: after.width, height: after.height }), {
        x: 0,
        y: 0,
      }),
    ).toMatchObject({ x: expect.closeTo(20, 6), y: expect.closeTo(40, 6) })
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
  it('brings the frame onto the rectangle', () => {
    const [after] = roundTrip(stack('a'), cropToRect({ x: 30, y: 40, width: 100, height: 80 }))

    expect([after.width, after.height]).toEqual([100, 80])
  })

  /**
   * The pixels move, the layers do not. A surface is document-sized and `CanvasEngine.resurface`
   * recuts it to the kept region, so the picture already starts where the new frame expects it —
   * sliding the transforms as well would displace it twice and empty one side of the document.
   */
  it('leaves the layer transforms where they were, since the surfaces carry the move', () => {
    const before = stack('a')
    const [after] = roundTrip(before, cropToRect({ x: 30, y: 40, width: 100, height: 80 }))

    expect(layerById(after, 'a')?.transform).toEqual(layerById(before, 'a')?.transform)
  })

  it('gives the frame back on undo', () => {
    const before = { ...stack('a'), width: 100, height: 100 }
    const [, reverted] = roundTrip(before, cropToRect({ x: 30, y: 40, width: 50, height: 50 }))

    expect([reverted.width, reverted.height]).toEqual([100, 100])
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

  it('reorders within the group', () => {
    const [after] = roundTrip(nested(), moveLayer('a', 'g', 1))

    expect(childrenOf(after, 'g')).toEqual(['b', 'a'])
  })

  it('takes a layer into a group', () => {
    const [after, back] = roundTrip(nested(), moveLayer('c', 'g', 0))

    expect(namesOf(after)).toEqual(['g'])
    expect(childrenOf(after, 'g')).toEqual(['c', 'a', 'b'])
    expect(namesOf(back)).toEqual(['g', 'c'])
  })

  it('takes a layer out of a group, above it', () => {
    const [after] = roundTrip(nested(), moveLayer('a', null, 1))

    expect(namesOf(after)).toEqual(['g', 'a', 'c'])
    expect(childrenOf(after, 'g')).toEqual(['b'])
  })

  /**
   * The drop would carry the receiving group along with the moved one, and every layer under it
   * would leave the document with no way back.
   */
  it('refuses a group dropped into its own subtree', () => {
    const outer = groupLayers(['g', 'c'], 'outer', 'Outer').apply(nested())

    expect(moveLayer('outer', 'g', 0).apply(outer)).toBe(outer)
  })

  it('refuses a layer dropped into something that is not a group', () => {
    const before = nested()

    expect(moveLayer('c', 'a', 0).apply(before)).toBe(before)
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
  function port(answers = true) {
    const calls: string[] = []
    const lost: string[] = []
    return {
      calls,
      lost: (id: string) => void lost.push(id),
      losses: lost,
      restore: (id: string, side: string) => (calls.push(`${id}:${side}`), answers),
    }
  }

  // A resurface drops every tile without telling the stack, and the entry left behind is a ⌘Z
  // that visibly does nothing. The port is told so it can take the entry off.
  it('reports a replay that found nothing', () => {
    const spy = port(false)
    const command = paintPixels('p1', spy)
    command.revert(DEFAULT_CANVAS)

    expect(spy.losses).toEqual(['p1'])
  })

  it('says nothing when the tiles are still there', () => {
    const spy = port()
    const command = paintPixels('p1', spy)
    command.revert(DEFAULT_CANVAS)

    expect(spy.losses).toEqual([])
  })

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

describe('flipping and turning the whole document', () => {
  const holding = (transform: Transform): CanvasState => ({
    ...DEFAULT_CANVAS,
    width: 100,
    height: 200,
    layers: [{ ...pixelLayer('a', 'A'), transform }],
    activeLayerId: 'a',
  })

  const placed = (x: number, y: number): CanvasState => holding({ ...IDENTITY, x, y })

  const turnedBy = (rotation: number): CanvasState => holding({ ...IDENTITY, rotation })

  const transformOf = (state: CanvasState) => state.layers[0]?.transform

  /**
   * Where the layer's pixels actually land in the document. Asserted instead of the transform
   * it holds: `x` is not the position of the content once a scale or a turn is on, so a suite
   * that reads `x` alone stays green while the whole layer sits outside the frame.
   */
  const contentOf = (state: CanvasState, frame?: Size): Rect => {
    const box = { width: state.width, height: state.height }
    const transform = transformOf(state)
    if (!transform) throw new Error('the fixture has no layer')

    return mapRect(layerMatrix(transform, box), { x: 0, y: 0, ...(frame ?? box) })
  }

  const near = (rect: Rect) => ({
    x: expect.closeTo(rect.x, 6),
    y: expect.closeTo(rect.y, 6),
    width: expect.closeTo(rect.width, 6),
    height: expect.closeTo(rect.height, 6),
  })

  // A negative scale rather than rewritten pixels: flipping twice is exactly the identity, which
  // resampling twice would not be.
  it('mirrors without touching a single pixel', () => {
    const [after] = roundTrip(placed(10, 20), flipImage('horizontal'))

    expect(transformOf(after)).toMatchObject({ scaleX: -1 })
  })

  // The frame is [0, 100]: a layer that sat at [10, 110] mirrors onto [-10, 90]. Writing
  // `width - x` sent it to [90, 190] — one whole document out, and the screen went blank.
  it('mirrors the pixels onto the other side of the frame', () => {
    const [after] = roundTrip(placed(10, 20), flipImage('horizontal'))

    expect(contentOf(after)).toMatchObject(near({ x: -10, y: 20, width: 100, height: 200 }))
  })

  it('mirrors the other way on the other axis', () => {
    const [after] = roundTrip(placed(10, 20), flipImage('vertical'))

    expect(transformOf(after)).toMatchObject({ scaleY: -1 })
    expect(contentOf(after)).toMatchObject(near({ x: 10, y: -20, width: 100, height: 200 }))
  })

  // The layer covers the frame exactly, so mirroring must leave it covering the frame exactly.
  it('leaves a layer that fills the frame filling it', () => {
    const [after] = roundTrip(placed(0, 0), flipImage('horizontal'))

    expect(contentOf(after)).toMatchObject(near({ x: 0, y: 0, width: 100, height: 200 }))
  })

  // A turned layer sweeps the other way once mirrored: the angles turn with the scale, or the
  // content lands somewhere the mirror never sent it.
  it('mirrors a turned layer onto its own reflection', () => {
    const turned = turnedBy(Math.PI / 6)
    const [after] = roundTrip(turned, flipImage('horizontal'))
    const before = contentOf(turned)

    expect(contentOf(after)).toMatchObject(near({ ...before, x: 100 - before.x - before.width }))
  })

  it('puts everything back on an undo', () => {
    const before = placed(10, 20)
    const [, reverted] = roundTrip(before, flipImage('horizontal'))

    expect(reverted).toEqual(before)
  })

  /** Records which way the engine was told to turn its pixels, and in what order. */
  const turns = () => {
    const asked: boolean[] = []
    return Object.assign({ turn: (clockwise: boolean) => void asked.push(clockwise) }, { asked })
  }

  /**
   * The pixels turn from INSIDE the command, so an undo unturns them. Driven by the caller
   * instead, ⌘Z restored a portrait frame over landscape textures and the recut that followed
   * took half of every layer — the very loss this command exists to avoid.
   */
  it('turns the pixels one way and back on an undo', () => {
    const port = turns()
    const command = rotateImage(true, port)

    const after = command.apply(placed(10, 20))
    command.revert(after)

    expect(port.asked).toEqual([true, false])
  })

  it('turns them the other way on a redo', () => {
    const port = turns()
    const command = rotateImage(true, port)
    const after = command.apply(placed(10, 20))
    command.apply(command.revert(after))

    expect(port.asked).toEqual([true, false, true])
  })

  // The frame turns with the picture: a portrait becomes a landscape.
  it('swaps the sides of the frame a quarter turn', () => {
    const [after] = roundTrip(placed(10, 20), rotateImage(true, turns()))

    expect(after).toMatchObject({ width: 200, height: 100 })
  })

  /**
   * The turn lives in the pixels — `CanvasEngine.turnQuarter` transposes the surfaces first — so
   * the angle is NOT what to assert here. What the eye checks is that a layer filling the frame
   * still fills it once the frame has traded its sides.
   */
  it('leaves a layer that fills the frame filling the turned one', () => {
    const [after] = roundTrip(placed(0, 0), rotateImage(true, turns()))

    expect(contentOf(after)).toMatchObject(near({ x: 0, y: 0, width: 200, height: 100 }))
  })

  // The layer covered [10, 110] × [20, 220]; turning that clockwise in a 100 × 200 frame sends
  // its corners to (180, 10) and (−20, 110).
  it('carries a displaced layer to the place the turn sends it', () => {
    const [after] = roundTrip(placed(10, 20), rotateImage(true, turns()))

    expect(contentOf(after)).toMatchObject(near({ x: -20, y: 10, width: 200, height: 100 }))
  })

  it('turns the other way when asked', () => {
    const [after] = roundTrip(placed(10, 20), rotateImage(false, turns()))

    expect(contentOf(after)).toMatchObject(near({ x: 20, y: -10, width: 200, height: 100 }))
  })

  // Two scales that differ have to trade places with the sides they scale, or a layer stretched
  // across a portrait comes back stretched across the width of a landscape.
  it('trades the two scales of a stretched layer', () => {
    const stretched = holding({ ...IDENTITY, scaleX: 2, scaleY: 0.5 })
    const [after] = roundTrip(stretched, rotateImage(true, turns()))

    expect(transformOf(after)).toMatchObject({ scaleX: 0.5, scaleY: 2 })
  })

  const captioned = (x: number, y: number): CanvasState => ({
    ...DEFAULT_CANVAS,
    width: 100,
    height: 200,
    layers: [textLayer('t', 'test', { x, y }, { width: 40, height: 10 })],
    activeLayerId: 't',
  })

  /** What a paragraph's grips describe, which `contentOf` then places for us. */
  const captionBox = (state: CanvasState): Size => {
    const layer = state.layers[0]
    if (layer?.kind !== 'text' || !layer.box) throw new Error('the fixture has no caption')

    return layer.box
  }

  /**
   * The words are redrawn from the state, so a turned surface lasts until the next edit while the
   * box never turned at all. The caption covered [10, 50] × [20, 30], which a clockwise turn in a
   * 100 × 200 frame sends to [170, 180] × [10, 50].
   */
  it('carries a caption to the place the turn sends its box', () => {
    const [after] = roundTrip(captioned(10, 20), rotateImage(true, turns()))

    expect(contentOf(after, captionBox(after))).toMatchObject(
      near({ x: 170, y: 10, width: 10, height: 40 }),
    )
  })

  // Four quarter turns are one full turn, and one full turn is where the document started.
  it('comes back to its own frame after four turns', () => {
    let state = placed(10, 20)
    for (let turn = 0; turn < 4; turn += 1) [state] = roundTrip(state, rotateImage(true, turns()))

    expect(state).toMatchObject({ width: 100, height: 200 })
  })
})

const withAdjustment: CanvasState = addLayer(adjustmentLayer('adj', 'Exposure', 'exposure')).apply(
  DEFAULT_CANVAS,
)

const warmer = { ...NEUTRAL_ADJUSTMENTS, exposure: 1.5, temperature: 0.4 }

describe('setLayerAdjustment', () => {
  it('writes the whole stack onto the adjustment layer', () => {
    const [after] = roundTrip(withAdjustment, setLayerAdjustment('adj', warmer))
    const layer = layerById(after, 'adj')

    expect(layer?.kind === 'adjustment' ? layer.values : null).toEqual(warmer)
  })

  it('gives the grading it found back on undo', () => {
    const [, reverted] = roundTrip(withAdjustment, setLayerAdjustment('adj', warmer))
    const layer = layerById(reverted, 'adj')

    expect(layer?.kind === 'adjustment' ? layer.values : null).toEqual(NEUTRAL_ADJUSTMENTS)
  })

  // Typed apart from `patch` because it is spelled on one kind of layer; a pixel one named by
  // the same id is not an adjustment that lost its values.
  it('leaves a layer of another kind untouched', () => {
    const [after] = roundTrip(withTwo, setLayerAdjustment('layer-2', warmer))

    expect(after.layers).toEqual(withTwo.layers)
  })
})

describe('setLayerText', () => {
  const withText: CanvasState = addLayer(textLayer('cap', 'Hello', { x: 10, y: 20 })).apply(
    DEFAULT_CANVAS,
  )
  const wordsOf = (state: CanvasState) => {
    const layer = layerById(state, 'cap')
    return layer?.kind === 'text' ? layer.text : null
  }

  it('rewrites only the fields it was given', () => {
    const [after] = roundTrip(withText, setLayerText('cap', { text: 'Goodbye' }))
    const layer = layerById(after, 'cap')

    expect(wordsOf(after)).toBe('Goodbye')
    expect(layer?.kind === 'text' ? layer.size : null).toBe(48)
  })

  it('puts the caption it found back on undo', () => {
    const [, reverted] = roundTrip(withText, setLayerText('cap', { text: 'Goodbye', size: 12 }))

    expect(wordsOf(reverted)).toBe('Hello')
    expect(layerById(reverted, 'cap')).toEqual(layerById(withText, 'cap'))
  })

  it('leaves a layer of another kind untouched', () => {
    const [after] = roundTrip(withTwo, setLayerText('layer-2', { text: 'Goodbye' }))

    expect(after.layers).toEqual(withTwo.layers)
  })

  /**
   * A drag, a grip and an MCP client all land here, and only the first two pass through a
   * component — which is why the rounding is the command's job rather than the caller's.
   */
  it('rounds a box it is handed to whole pixels', () => {
    const [after] = roundTrip(
      withText,
      setLayerText('cap', { box: { width: 471.5789473684211, height: 242.52 } }),
    )
    const layer = layerById(after, 'cap')

    expect(layer?.kind === 'text' ? layer.box : null).toEqual({ width: 472, height: 243 })
  })
})

describe('resizeCaption', () => {
  const withText: CanvasState = addLayer(textLayer('cap', 'Hello', { x: 10, y: 20 })).apply(
    DEFAULT_CANVAS,
  )

  // A north or west grip moves the origin as it resizes, which is why both travel together.
  it('takes the box and where it now starts in one entry', () => {
    const [after] = roundTrip(
      withText,
      resizeCaption('cap', { width: 700.6, height: 310.2 }, { x: 4, y: 6 }),
    )
    const layer = layerById(after, 'cap')

    expect(layer?.kind === 'text' ? layer.box : null).toEqual({ width: 701, height: 310 })
    expect(layer?.transform.x).toBe(4)
    expect(layer?.transform.y).toBe(6)
  })

  /**
   * Both halves or neither. Shift-resizing and a turned caption both hand back a fractional
   * origin, and rounding only the box moved the edge the grip was supposed to hold still.
   */
  it('rounds where it starts too, never one half of the pair', () => {
    const [after] = roundTrip(
      withText,
      resizeCaption('cap', { width: 300.4, height: 120.6 }, { x: 12.7, y: 30.2 }),
    )
    const layer = layerById(after, 'cap')

    expect(layer?.transform.x).toBe(13)
    expect(layer?.transform.y).toBe(30)
  })

  it('puts the caption it found back on undo', () => {
    const [, reverted] = roundTrip(
      withText,
      resizeCaption('cap', { width: 700, height: 310 }, { x: 4, y: 6 }),
    )

    expect(layerById(reverted, 'cap')).toEqual(layerById(withText, 'cap'))
  })
})

/**
 * A command reverted before it ever applied. The panel builds one per edit and the history may
 * step over an entry whose `apply` ran on another document — every command captures what it
 * needs on the way in, so with nothing captured the only honest inverse is the state itself.
 */
describe('reverting a command that never applied', () => {
  it('leaves the stack alone for a single-field edit', () => {
    expect(setLayerBlend('layer-2', 'multiply').revert(withTwo)).toBe(withTwo)
  })

  it('leaves the stack alone for a move', () => {
    expect(translateLayer('layer-2', 40, 40).revert(withTwo)).toBe(withTwo)
  })

  it('leaves the grading alone', () => {
    expect(setLayerAdjustment('adj', warmer).revert(withAdjustment).layers).toEqual(
      withAdjustment.layers,
    )
  })

  it('leaves the guides alone', () => {
    expect(moveGuide('g1', 40).revert(withGuides)).toBe(withGuides)
    expect(removeGuide('g1').revert(withGuides)).toBe(withGuides)
  })
})

/**
 * An id that names nothing — a panel row acting on a layer another window has just removed.
 * Every one of these is a no-op rather than a stack quietly rebuilt around a hole.
 */
describe('commands aimed at a layer that is gone', () => {
  it('removes nothing', () => {
    expect(removeLayer('gone').apply(withTwo)).toBe(withTwo)
  })

  it('moves nothing', () => {
    expect(moveLayer('gone', null, 0).apply(withTwo)).toBe(withTwo)
  })

  it('duplicates nothing', () => {
    expect(duplicateLayer('gone', 'copy', 'Copy', ids()).apply(withTwo)).toBe(withTwo)
  })

  it('patches nothing, and has nothing to undo', () => {
    const command = setLayerBlend('gone', 'multiply')
    const applied = command.apply(withTwo)

    expect(applied.layers).toEqual(withTwo.layers)
    expect(command.revert(applied)).toBe(applied)
  })

  it('moves no guide, and has none to put back', () => {
    const command = moveGuide('gone', 40)
    const applied = command.apply(withGuides)

    expect(applied.guides).toEqual(withGuides.guides)
    expect(command.revert(applied)).toBe(applied)
  })

  it('removes no guide, and lays none back down', () => {
    const command = removeGuide('gone')
    const applied = command.apply(withGuides)

    expect(applied.guides).toEqual(withGuides.guides)
    expect(command.revert(applied)).toBe(applied)
  })
})

/**
 * A group holds no pixels, so arming one leaves the brush drawing nothing. When a restructure
 * turns up nothing paintable, it must not point the brush at a group to fill the field.
 */
describe('restructuring around layers that hold no pixels', () => {
  const emptyGroup = (id: string): CanvasState => ({
    ...DEFAULT_CANVAS,
    layers: [groupLayer(id, 'Empty', [])],
    activeLayerId: null,
  })

  it('arms nothing when the group it wrapped holds nothing paintable', () => {
    const [after] = roundTrip(emptyGroup('g0'), groupLayers(['g0'], 'g', 'Group'))

    expect(after.activeLayerId).toBeNull()
  })

  it('leaves the selection where it was when a dissolved group held nothing paintable', () => {
    const before = { ...emptyGroup('g0'), activeLayerId: 'elsewhere' }
    const [after] = roundTrip(before, ungroupLayer('g0'))

    expect(after.layers).toEqual([])
    expect(after.activeLayerId).toBe('elsewhere')
  })
})
