import { describe, expect, it } from 'vitest'
import { emptyHistory, run, undo } from '../core/history'
import {
  addNode,
  multi,
  removeNode,
  renameNode,
  selectNode,
  setGeometry,
  setLight,
  setMaterial,
  setNodeVisible,
  setTransform,
} from './commands'
import { lightNodeFixture as light, meshNode as mesh } from './scene-fixtures'
import { DEFAULT_MATERIAL, EMPTY_SCENE, IDENTITY_TRANSFORM, type SceneState } from './scene-state'

describe('addNode', () => {
  it('appends the node and selects it', () => {
    const state = addNode(mesh('a')).apply(EMPTY_SCENE)
    expect(state.nodes.map(node => node.id)).toEqual(['a'])
    expect(state.selectedId).toBe('a')
  })

  it('drops the node and its selection on revert', () => {
    const command = addNode(mesh('a'))
    expect(command.revert(command.apply(EMPTY_SCENE))).toEqual(EMPTY_SCENE)
  })
})

describe('removeNode', () => {
  it('restores the node at its original index', () => {
    const start: SceneState = { nodes: [mesh('a'), mesh('b'), mesh('c')], selectedId: null }
    const command = removeNode('b')
    const removed = command.apply(start)
    expect(removed.nodes.map(node => node.id)).toEqual(['a', 'c'])
    expect(command.revert(removed).nodes.map(node => node.id)).toEqual(['a', 'b', 'c'])
  })

  it('clears the selection when it removes the selected node', () => {
    const start: SceneState = { nodes: [mesh('a')], selectedId: 'a' }
    expect(removeNode('a').apply(start).selectedId).toBeNull()
  })

  it('leaves an unknown id alone', () => {
    const start: SceneState = { nodes: [mesh('a')], selectedId: null }
    expect(removeNode('ghost').apply(start)).toEqual(start)
  })
})

describe('setNodeVisible', () => {
  it('toggles visibility and comes back', () => {
    const start: SceneState = { nodes: [mesh('a')], selectedId: null }
    const command = setNodeVisible('a', false)
    const hidden = command.apply(start)
    expect(hidden.nodes[0]?.visible).toBe(false)
    expect(command.revert(hidden).nodes[0]?.visible).toBe(true)
  })
})

describe('renameNode', () => {
  it('renames and comes back', () => {
    const start: SceneState = { nodes: [mesh('a')], selectedId: null }
    const command = renameNode('a', 'Cube')
    const renamed = command.apply(start)
    expect(renamed.nodes[0]?.name).toBe('Cube')
    expect(command.revert(renamed).nodes[0]?.name).toBe('a')
  })
})

describe('setTransform', () => {
  it('survives being replayed through the history', () => {
    const start: SceneState = { nodes: [mesh('a')], selectedId: null }
    const moved = { ...IDENTITY_TRANSFORM, position: { x: 1, y: 2, z: 3 } }
    const [after, history] = run(start, emptyHistory<SceneState>(), setTransform('a', moved))
    expect(after.nodes[0]?.transform.position).toEqual({ x: 1, y: 2, z: 3 })

    const [back] = undo(after, history)
    expect(back.nodes[0]?.transform.position).toEqual({ x: 0, y: 0, z: 0 })
  })

  it('leaves the discriminated half of the node untouched', () => {
    const start: SceneState = { nodes: [mesh('a')], selectedId: null }
    const moved = { ...IDENTITY_TRANSFORM, position: { x: 5, y: 0, z: 0 } }
    const after = setTransform('a', moved).apply(start)
    const node = after.nodes[0]
    expect(node?.type).toBe('mesh')
    expect(node?.type === 'mesh' && node.geometry.kind).toBe('box')
  })
})

describe('setGeometry', () => {
  it('replaces the descriptor and comes back', () => {
    const start: SceneState = { nodes: [mesh('a')], selectedId: null }
    const command = setGeometry('a', {
      kind: 'sphere',
      radius: 2,
      widthSegments: 8,
      heightSegments: 6,
    })

    const applied = command.apply(start)
    const node = applied.nodes[0]
    expect(node?.type === 'mesh' && node.geometry.kind).toBe('sphere')

    const back = command.revert(applied).nodes[0]
    expect(back?.type === 'mesh' && back.geometry.kind).toBe('box')
  })

  // A light holding a geometry is what the union exists to forbid, and it would be a document
  // that no longer loads.
  it('refuses to give a light a geometry', () => {
    const start: SceneState = { nodes: [light('a')], selectedId: null }
    const command = setGeometry('a', {
      kind: 'sphere',
      radius: 1,
      widthSegments: 8,
      heightSegments: 6,
    })

    expect(command.apply(start)).toEqual(start)
  })
})

describe('setMaterial', () => {
  it('replaces the material and comes back', () => {
    const start: SceneState = { nodes: [mesh('a')], selectedId: null }
    const command = setMaterial('a', {
      ...DEFAULT_MATERIAL,
      color: '#ff0000',
      roughness: 0.2,
      metalness: 1,
    })

    const applied = command.apply(start)
    const node = applied.nodes[0]
    expect(node?.type === 'mesh' && node.material.color).toBe('#ff0000')

    const back = command.revert(applied).nodes[0]
    expect(back?.type === 'mesh' && back.material.roughness).toBe(1)
  })

  it('leaves the geometry it did not touch alone', () => {
    const start: SceneState = { nodes: [mesh('a')], selectedId: null }
    const command = setMaterial('a', { ...DEFAULT_MATERIAL, roughness: 0.5 })

    const node = command.apply(start).nodes[0]
    expect(node?.type === 'mesh' && node.geometry.kind).toBe('box')
  })
})

describe('setLight', () => {
  it('replaces the descriptor and comes back', () => {
    const start: SceneState = { nodes: [light('a')], selectedId: null }
    const command = setLight('a', { kind: 'ambient', color: '#ffffff', intensity: 0.5 })

    const applied = command.apply(start)
    const node = applied.nodes[0]
    expect(node?.type === 'light' && node.light.intensity).toBe(0.5)

    const back = command.revert(applied).nodes[0]
    expect(back?.type === 'light' && back.light.intensity).toBe(1)
  })

  it('refuses to give a mesh a light', () => {
    const start: SceneState = { nodes: [mesh('a')], selectedId: null }

    expect(setLight('a', { kind: 'ambient', color: '#ffffff', intensity: 1 }).apply(start)).toEqual(
      start,
    )
  })
})

describe('multi', () => {
  it('undoes a batch in reverse order, as one entry', () => {
    const batch = multi('batch', [addNode(mesh('a')), addNode(mesh('b'))])
    const applied = batch.apply(EMPTY_SCENE)
    expect(applied.nodes.map(node => node.id)).toEqual(['a', 'b'])
    expect(batch.revert(applied).nodes).toEqual([])
  })
})

describe('selectNode', () => {
  it('stays out of the history', () => {
    const start: SceneState = { nodes: [mesh('a')], selectedId: null }
    expect(selectNode(start, 'a').selectedId).toBe('a')
    expect(selectNode(start, null).selectedId).toBeNull()
  })
})
