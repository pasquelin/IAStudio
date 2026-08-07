import { describe, expect, it } from 'vitest'
import {
  childrenOf,
  DEFAULT_MATERIAL,
  deserializeScene,
  EMPTY_SCENE,
  IDENTITY_TRANSFORM,
  nodeById,
  serializeScene,
  type SceneNode,
  type SceneState,
} from './scene-state'

function mesh(id: string, parentId: string | null = null): SceneNode {
  return {
    id,
    parentId,
    name: id,
    visible: true,
    transform: IDENTITY_TRANSFORM,
    type: 'mesh',
    geometry: { kind: 'box', width: 1, height: 1, depth: 1 },
    material: DEFAULT_MATERIAL,
  }
}

function light(id: string): SceneNode {
  return {
    id,
    parentId: null,
    name: id,
    visible: true,
    transform: IDENTITY_TRANSFORM,
    type: 'light',
    light: { kind: 'ambient', color: '#222222', intensity: 1 },
  }
}

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

describe('deserializeScene', () => {
  it('round-trips a serialized scene', () => {
    const state: SceneState = { nodes: [mesh('a'), light('b')], selectedId: 'a' }
    expect(deserializeScene(serializeScene(state))).toEqual(state)
  })

  it('yields an empty scene rather than throwing on unreadable input', () => {
    // The state comes from a store that may outlive a format change; a blank viewport beats
    // an unhandled throw with no error boundary above it.
    expect(deserializeScene('{ not json')).toEqual(EMPTY_SCENE)
  })

  it('yields an empty scene when nodes is not an array', () => {
    expect(deserializeScene('{"nodes":"nope"}')).toEqual(EMPTY_SCENE)
  })

  it('drops a selection that is not a string', () => {
    expect(deserializeScene('{"nodes":[],"selectedId":7}').selectedId).toBeNull()
  })
})
