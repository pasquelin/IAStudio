import { describe, expect, it } from 'vitest'
import { emptyHistory, run, undo } from '../core/history'
import {
  addNode,
  batch,
  moveNodes,
  multi,
  removeNode,
  removeNodes,
  renameNode,
  setGeometry,
  setLight,
  setLightOn,
  setMaterial,
  setNodeVisible,
  setSelection,
  setTransform,
} from './commands'
import { lightNodeFixture as light, meshNode as mesh } from './scene-fixtures'
import { DEFAULT_MATERIAL, EMPTY_SCENE, IDENTITY_TRANSFORM, type SceneState } from './scene-state'

describe('addNode', () => {
  it('appends the node and selects it', () => {
    const state = addNode(mesh('a')).apply(EMPTY_SCENE)
    expect(state.nodes.map(node => node.id)).toEqual(['a'])
    expect(state.selectedIds).toEqual(['a'])
  })

  it('drops the node and its selection on revert', () => {
    const command = addNode(mesh('a'))
    expect(command.revert(command.apply(EMPTY_SCENE))).toEqual(EMPTY_SCENE)
  })
})

describe('removeNode', () => {
  it('restores the node at its original index', () => {
    const start: SceneState = { nodes: [mesh('a'), mesh('b'), mesh('c')], selectedIds: [] }
    const command = removeNode('b')
    const removed = command.apply(start)
    expect(removed.nodes.map(node => node.id)).toEqual(['a', 'c'])
    expect(command.revert(removed).nodes.map(node => node.id)).toEqual(['a', 'b', 'c'])
  })

  it('drops the removed node from the selection and leaves the rest of it standing', () => {
    const start: SceneState = { nodes: [mesh('a'), mesh('b')], selectedIds: ['a', 'b'] }
    expect(removeNode('a').apply(start).selectedIds).toEqual(['b'])
  })

  it('hands the anchor back to the previous node when it removes the anchor', () => {
    const start: SceneState = { nodes: [mesh('a'), mesh('b')], selectedIds: ['a', 'b'] }
    expect(removeNode('b').apply(start).selectedIds.at(-1)).toBe('a')
  })

  it('leaves an unknown id alone', () => {
    const start: SceneState = { nodes: [mesh('a')], selectedIds: [] }
    expect(removeNode('ghost').apply(start)).toEqual(start)
  })
})

describe('setNodeVisible', () => {
  it('toggles visibility and comes back', () => {
    const start: SceneState = { nodes: [mesh('a')], selectedIds: [] }
    const command = setNodeVisible('a', false)
    const hidden = command.apply(start)
    expect(hidden.nodes[0]?.visible).toBe(false)
    expect(command.revert(hidden).nodes[0]?.visible).toBe(true)
  })
})

describe('renameNode', () => {
  it('renames and comes back', () => {
    const start: SceneState = { nodes: [mesh('a')], selectedIds: [] }
    const command = renameNode('a', 'Cube')
    const renamed = command.apply(start)
    expect(renamed.nodes[0]?.name).toBe('Cube')
    expect(command.revert(renamed).nodes[0]?.name).toBe('a')
  })
})

describe('setTransform', () => {
  it('survives being replayed through the history', () => {
    const start: SceneState = { nodes: [mesh('a')], selectedIds: [] }
    const moved = { ...IDENTITY_TRANSFORM, position: { x: 1, y: 2, z: 3 } }
    const [after, history] = run(start, emptyHistory<SceneState>(), setTransform('a', moved))
    expect(after.nodes[0]?.transform.position).toEqual({ x: 1, y: 2, z: 3 })

    const [back] = undo(after, history)
    expect(back.nodes[0]?.transform.position).toEqual({ x: 0, y: 0, z: 0 })
  })

  it('leaves the discriminated half of the node untouched', () => {
    const start: SceneState = { nodes: [mesh('a')], selectedIds: [] }
    const moved = { ...IDENTITY_TRANSFORM, position: { x: 5, y: 0, z: 0 } }
    const after = setTransform('a', moved).apply(start)
    const node = after.nodes[0]
    expect(node?.type).toBe('mesh')
    expect(node?.type === 'mesh' && node.geometry.kind).toBe('box')
  })
})

describe('setGeometry', () => {
  it('replaces the descriptor and comes back', () => {
    const start: SceneState = { nodes: [mesh('a')], selectedIds: [] }
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
    const start: SceneState = { nodes: [light('a')], selectedIds: [] }
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
    const start: SceneState = { nodes: [mesh('a')], selectedIds: [] }
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
    const start: SceneState = { nodes: [mesh('a')], selectedIds: [] }
    const command = setMaterial('a', { ...DEFAULT_MATERIAL, roughness: 0.5 })

    const node = command.apply(start).nodes[0]
    expect(node?.type === 'mesh' && node.geometry.kind).toBe('box')
  })
})

describe('setLight', () => {
  it('replaces the descriptor and comes back', () => {
    const start: SceneState = { nodes: [light('a')], selectedIds: [] }
    const command = setLight('a', { kind: 'ambient', color: '#ffffff', intensity: 0.5 })

    const applied = command.apply(start)
    const node = applied.nodes[0]
    expect(node?.type === 'light' && node.light.intensity).toBe(0.5)

    const back = command.revert(applied).nodes[0]
    expect(back?.type === 'light' && back.light.intensity).toBe(1)
  })

  it('refuses to give a mesh a light', () => {
    const start: SceneState = { nodes: [mesh('a')], selectedIds: [] }

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

describe('setSelection', () => {
  const start: SceneState = { nodes: [mesh('a'), mesh('b'), mesh('c')], selectedIds: [] }

  it('stays out of the history', () => {
    expect(setSelection(start, ['a']).selectedIds).toEqual(['a'])
    expect(setSelection(start, []).selectedIds).toEqual([])
  })

  it('replaces by default', () => {
    const picked = setSelection(start, ['a', 'b'])
    expect(setSelection(picked, ['c']).selectedIds).toEqual(['c'])
  })

  it('toggles an id in and out of what is already selected', () => {
    const picked = setSelection(start, ['a', 'b'])
    expect(setSelection(picked, ['c'], 'toggle').selectedIds).toEqual(['a', 'b', 'c'])
    expect(setSelection(picked, ['b'], 'toggle').selectedIds).toEqual(['a'])
  })

  it('leaves the nodes alone', () => {
    expect(setSelection(start, ['a']).nodes).toBe(start.nodes)
  })
})

describe('removeNodes', () => {
  it('deletes a whole selection as one entry, and puts it back in order', () => {
    const start: SceneState = {
      nodes: [mesh('a'), mesh('b'), mesh('c')],
      selectedIds: ['a', 'c'],
    }
    const command = removeNodes(['a', 'c'])
    const applied = command.apply(start)

    expect(applied.nodes.map(node => node.id)).toEqual(['b'])
    expect(applied.selectedIds).toEqual([])
    expect(command.revert(applied).nodes.map(node => node.id)).toEqual(['a', 'b', 'c'])
  })
})

describe('moveNodes', () => {
  it('carries one drag of several nodes as one entry', () => {
    const start: SceneState = { nodes: [mesh('a'), mesh('b')], selectedIds: ['a', 'b'] }
    const moved = { ...IDENTITY_TRANSFORM, position: { x: 1, y: 2, z: 3 } }
    const command = moveNodes([
      { id: 'a', transform: moved },
      { id: 'b', transform: moved },
    ])

    const applied = command.apply(start)
    expect(applied.nodes.map(node => node.transform.position.x)).toEqual([1, 1])
    expect(command.revert(applied).nodes.map(node => node.transform.position.x)).toEqual([0, 0])
  })

  it('keeps the id a single move would have had, so a gesture still coalesces', () => {
    expect(moveNodes([{ id: 'a', transform: IDENTITY_TRANSFORM }]).id).toBe(
      setTransform('a', IDENTITY_TRANSFORM).id,
    )
  })
})

describe('setLightOn', () => {
  const spot = (id: string, target: { x: number; y: number; z: number }): SceneState['nodes'][0] =>
    light(id, {
      kind: 'spot',
      color: '#ffffff',
      intensity: 1,
      distance: 0,
      angle: 0.3,
      penumbra: 0,
      decay: 2,
      target,
    })

  // A vector field reports all three axes though the user moved one.
  it('carries only the axis that moved onto the other lights', () => {
    const anchor = spot('a', { x: 0, y: 0, z: 0 })
    const other = spot('b', { x: 5, y: 6, z: 7 })
    const start: SceneState = { nodes: [anchor, other], selectedIds: ['b', 'a'] }
    if (anchor.type !== 'light') throw new Error('fixture is not a light')

    const applied = setLightOn(start.nodes, anchor.light, 'target', { x: 0, y: 9, z: 0 }).apply(
      start,
    )

    const moved = applied.nodes[1]
    expect(moved?.type === 'light' && moved.light.kind === 'spot' && moved.light.target).toEqual({
      x: 5,
      y: 9,
      z: 7,
    })
  })

  it('leaves a light of another kind alone', () => {
    const anchor = spot('a', { x: 0, y: 0, z: 0 })
    const ambient = light('b')
    const start: SceneState = { nodes: [anchor, ambient], selectedIds: ['b', 'a'] }
    if (anchor.type !== 'light') throw new Error('fixture is not a light')

    expect(setLightOn(start.nodes, anchor.light, 'intensity', 4).apply(start).nodes[1]).toBe(
      ambient,
    )
  })
})

describe('batch', () => {
  const start: SceneState = { nodes: [mesh('a'), mesh('b'), light('c')], selectedIds: [] }

  it('edits every node of a selection as one entry in the history', () => {
    const command = batch('rename', start.nodes, node => renameNode(node.id, 'same'))
    const applied = command.apply(start)

    expect(applied.nodes.map(node => node.name)).toEqual(['same', 'same', 'same'])
    expect(command.revert(applied).nodes.map(node => node.name)).toEqual(
      start.nodes.map(node => node.name),
    )
  })

  it('skips the nodes the edit does not apply to', () => {
    const meshes = start.nodes.filter(node => node.type === 'mesh')
    const command = batch('rename', start.nodes, node =>
      node.type === 'mesh' ? renameNode(node.id, 'mesh') : null,
    )

    expect(command.apply(start).nodes.map(node => node.name)).toEqual([
      'mesh',
      'mesh',
      start.nodes[2]?.name,
    ])
    expect(meshes).toHaveLength(2)
  })

  it('names the nodes it touched, so an edit of another selection is another entry', () => {
    const one = batch('transform', [start.nodes[0] ?? mesh('a')], () => null)
    const two = batch('transform', start.nodes, () => null)
    expect(one.id).not.toBe(two.id)
  })
})
