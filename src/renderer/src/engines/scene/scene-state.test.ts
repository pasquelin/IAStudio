import { describe, expect, it } from 'vitest'
import { lightNodeFixture as light, meshNode as mesh } from './scene-fixtures'
import {
  canReparent,
  childrenOf,
  EMPTY_SCENE,
  nodeById,
  selectedNodes,
  subtreeOf,
  type SceneState,
} from './scene-state'

describe('EMPTY_SCENE', () => {
  it('starts empty with nothing selected', () => {
    expect(EMPTY_SCENE.nodes).toHaveLength(0)
    expect(EMPTY_SCENE.selectedIds).toEqual([])
  })
})

describe('nodeById', () => {
  it('finds a node by its id', () => {
    const state: SceneState = { ...EMPTY_SCENE, nodes: [mesh('a'), light('b')], selectedIds: [] }
    expect(nodeById(state, 'b')?.type).toBe('light')
  })

  it('returns null for an unknown id', () => {
    expect(nodeById({ ...EMPTY_SCENE, nodes: [mesh('a')], selectedIds: [] }, 'ghost')).toBeNull()
  })
})

describe('selectedNodes', () => {
  const nodes = [mesh('a'), mesh('b'), mesh('c')]

  it('is nothing when nothing is selected', () => {
    expect(selectedNodes(nodes, [])).toEqual([])
  })

  it('keeps the order the selection was built in, so the last one is the anchor', () => {
    expect(selectedNodes(nodes, ['c', 'a']).map(node => node.id)).toEqual(['c', 'a'])
    expect(selectedNodes(nodes, ['c', 'a']).at(-1)?.id).toBe('a')
  })

  it('drops the ids nothing answers to rather than reporting holes', () => {
    expect(selectedNodes(nodes, ['a', 'ghost']).map(node => node.id)).toEqual(['a'])
  })
})

/** The classic bug of reparenting: a tree closed on itself, and every walk of it runs forever. */
describe('canReparent', () => {
  // a > b > c
  const nodes = [mesh('a'), mesh('b', 'a'), mesh('c', 'b')]

  it('lets a node hang from an unrelated one, and from the scene', () => {
    expect(canReparent(nodes, 'c', null)).toBe(true)
    expect(canReparent([mesh('a'), mesh('b')], 'a', 'b')).toBe(true)
  })

  it('refuses a node under itself', () => {
    expect(canReparent(nodes, 'a', 'a')).toBe(false)
  })

  it('refuses a node under its own child', () => {
    expect(canReparent(nodes, 'a', 'b')).toBe(false)
  })

  it('refuses a node under a deeper descendant, not only a direct child', () => {
    expect(canReparent(nodes, 'a', 'c')).toBe(false)
  })

  it('answers rather than looping when the tree already holds a cycle', () => {
    const looped = [mesh('a', 'b'), mesh('b', 'a')]
    expect(canReparent(looped, 'a', 'b')).toBe(false)
  })
})

describe('subtreeOf', () => {
  const nodes = [mesh('a'), mesh('b', 'a'), mesh('c', 'b'), mesh('d')]

  it('carries a node and everything under it, however deep', () => {
    expect(subtreeOf(nodes, 'a').map(node => node.id)).toEqual(['a', 'b', 'c'])
  })

  it('is the node alone when nothing hangs from it', () => {
    expect(subtreeOf(nodes, 'd').map(node => node.id)).toEqual(['d'])
  })

  it('leaves the branches beside it alone', () => {
    expect(subtreeOf(nodes, 'b').map(node => node.id)).toEqual(['b', 'c'])
  })

  /**
   * Reparenting changes a `parentId` in place, so a child can perfectly well be listed before
   * the parent it now hangs from. Reading the array in order left those behind — nodes nothing
   * showed any more, that no delete could reach, and that the file kept.
   */
  it('finds a branch whose child is declared before its parent', () => {
    const jumbled = [mesh('c', 'a'), mesh('a', 'b'), mesh('b')]
    expect(
      subtreeOf(jumbled, 'b')
        .map(node => node.id)
        .sort(),
    ).toEqual(['a', 'b', 'c'])
  })
})

describe('childrenOf', () => {
  it('keeps the declared order', () => {
    const state: SceneState = {
      ...EMPTY_SCENE,
      nodes: [mesh('a'), mesh('b'), mesh('c')],
      selectedIds: [],
    }
    expect(childrenOf(state, null).map(node => node.id)).toEqual(['a', 'b', 'c'])
  })

  it('separates roots from children', () => {
    const state: SceneState = {
      ...EMPTY_SCENE,
      nodes: [mesh('a'), mesh('b', 'a')],
      selectedIds: [],
    }
    expect(childrenOf(state, null).map(node => node.id)).toEqual(['a'])
    expect(childrenOf(state, 'a').map(node => node.id)).toEqual(['b'])
  })

  it('answers with nothing for a childless parent', () => {
    const state: SceneState = { ...EMPTY_SCENE, nodes: [mesh('a')], selectedIds: [] }
    expect(childrenOf(state, 'a')).toEqual([])
  })
})
