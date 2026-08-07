import { describe, expect, it } from 'vitest'
import { lightNodeFixture as light, meshNode as mesh } from './scene-fixtures'
import { childrenOf, EMPTY_SCENE, nodeById, type SceneState } from './scene-state'

describe('EMPTY_SCENE', () => {
  it('starts empty with nothing selected', () => {
    expect(EMPTY_SCENE.nodes).toHaveLength(0)
    expect(EMPTY_SCENE.selectedId).toBeNull()
  })
})

describe('nodeById', () => {
  it('finds a node by its id', () => {
    const state: SceneState = { nodes: [mesh('a'), light('b')], selectedId: null }
    expect(nodeById(state, 'b')?.type).toBe('light')
  })

  it('returns null for an unknown id', () => {
    expect(nodeById({ nodes: [mesh('a')], selectedId: null }, 'ghost')).toBeNull()
  })
})

describe('childrenOf', () => {
  it('keeps the declared order', () => {
    const state: SceneState = { nodes: [mesh('a'), mesh('b'), mesh('c')], selectedId: null }
    expect(childrenOf(state, null).map(node => node.id)).toEqual(['a', 'b', 'c'])
  })

  it('separates roots from children', () => {
    const state: SceneState = { nodes: [mesh('a'), mesh('b', 'a')], selectedId: null }
    expect(childrenOf(state, null).map(node => node.id)).toEqual(['a'])
    expect(childrenOf(state, 'a').map(node => node.id)).toEqual(['b'])
  })

  it('answers with nothing for a childless parent', () => {
    const state: SceneState = { nodes: [mesh('a')], selectedId: null }
    expect(childrenOf(state, 'a')).toEqual([])
  })
})
