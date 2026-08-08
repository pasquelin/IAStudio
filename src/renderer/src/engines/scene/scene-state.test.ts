import { describe, expect, it } from 'vitest'
import { lightNodeFixture as light, meshNode as mesh } from './scene-fixtures'
import { childrenOf, EMPTY_SCENE, nodeById, selectedNodes, type SceneState } from './scene-state'

describe('EMPTY_SCENE', () => {
  it('starts empty with nothing selected', () => {
    expect(EMPTY_SCENE.nodes).toHaveLength(0)
    expect(EMPTY_SCENE.selectedIds).toEqual([])
  })
})

describe('nodeById', () => {
  it('finds a node by its id', () => {
    const state: SceneState = { nodes: [mesh('a'), light('b')], selectedIds: [] }
    expect(nodeById(state, 'b')?.type).toBe('light')
  })

  it('returns null for an unknown id', () => {
    expect(nodeById({ nodes: [mesh('a')], selectedIds: [] }, 'ghost')).toBeNull()
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

describe('childrenOf', () => {
  it('keeps the declared order', () => {
    const state: SceneState = { nodes: [mesh('a'), mesh('b'), mesh('c')], selectedIds: [] }
    expect(childrenOf(state, null).map(node => node.id)).toEqual(['a', 'b', 'c'])
  })

  it('separates roots from children', () => {
    const state: SceneState = { nodes: [mesh('a'), mesh('b', 'a')], selectedIds: [] }
    expect(childrenOf(state, null).map(node => node.id)).toEqual(['a'])
    expect(childrenOf(state, 'a').map(node => node.id)).toEqual(['b'])
  })

  it('answers with nothing for a childless parent', () => {
    const state: SceneState = { nodes: [mesh('a')], selectedIds: [] }
    expect(childrenOf(state, 'a')).toEqual([])
  })
})
