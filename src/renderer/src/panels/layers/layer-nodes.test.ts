import { describe, expect, it } from 'vitest'
import {
  DEFAULT_CANVAS,
  groupLayer,
  pixelLayer,
  type CanvasState,
  type Layer,
} from '@/engines/canvas/canvasState'
import { layerNodes, stackIndex } from './layer-nodes'

const canvasOf = (layers: readonly Layer[]): CanvasState => ({
  ...DEFAULT_CANVAS,
  layers: [...layers],
})

describe('listing a stack', () => {
  // The state is bottom first, because that is the order it is drawn in.
  it('puts the top of the stack at the top of the list', () => {
    const nodes = layerNodes([pixelLayer('a', 'A'), pixelLayer('b', 'B')])

    expect(nodes.map(node => node.id)).toEqual(['b', 'a'])
  })

  it('lists the children of a group under it, and names it as their parent', () => {
    const stack = [groupLayer('g', 'G', [pixelLayer('a', 'A'), pixelLayer('b', 'B')])]

    expect(layerNodes(stack).map(node => [node.id, node.parentId])).toEqual([
      ['g', null],
      ['b', 'g'],
      ['a', 'g'],
    ])
  })

  it('nests as deep as the tree goes', () => {
    const inner = groupLayer('inner', 'Inner', [pixelLayer('a', 'A')])

    expect(layerNodes([groupLayer('outer', 'Outer', [inner])]).map(node => node.id)).toEqual([
      'outer',
      'inner',
      'a',
    ])
  })

  /**
   * A folded group keeps its whole subtree here — `Tree` is what hides it, from `expandedIds`.
   * Dropping it from the list would leave the tree unable to reveal it again without rebuilding.
   */
  it('lists what a collapsed group holds, and leaves the hiding to the tree', () => {
    const folded: Layer = { ...groupLayer('g', 'G', [pixelLayer('a', 'A')]), collapsed: true }

    expect(layerNodes([folded]).map(node => node.id)).toEqual(['g', 'a'])
  })
})

/**
 * The list counts from the top and the stack from the bottom, so every drop crosses the two.
 * Getting this backwards puts a layer at the far end of its level, which reads as a drag that
 * went somewhere nobody aimed at.
 */
describe('turning a list position into a stack index', () => {
  it('drops at the top of the list onto the top of the stack', () => {
    const state = canvasOf([pixelLayer('a', 'A'), pixelLayer('b', 'B'), pixelLayer('c', 'C')])

    // 'c' is already the top of the stack: two layers stay below it.
    expect(stackIndex(state, 'c', null, 0)).toBe(2)
  })

  it('drops at the bottom of the list onto the bottom of the stack', () => {
    const state = canvasOf([pixelLayer('a', 'A'), pixelLayer('b', 'B'), pixelLayer('c', 'C')])

    expect(stackIndex(state, 'c', null, 2)).toBe(0)
  })

  it('counts a level the moved layer never belonged to whole', () => {
    const state = canvasOf([pixelLayer('a', 'A'), groupLayer('g', 'G', [pixelLayer('x', 'X')])])

    // 'a' comes from the root, so the group keeps both of its places.
    expect(stackIndex(state, 'a', 'g', 0)).toBe(1)
  })

  it('counts nothing for a parent that is not a group', () => {
    const state = canvasOf([pixelLayer('a', 'A'), pixelLayer('b', 'B')])

    expect(stackIndex(state, 'a', 'b', 0)).toBe(0)
  })
})
