import { describe, expect, it } from 'vitest'
import { clipLane, embeddedClip, wornMaterials } from '@shared/domain/scene'
import { emptyHistory, run, undo, type Command } from '../core/history'
import {
  addNode,
  addNodes,
  carveNodes,
  separateNode,
  batch,
  copiesOf,
  groupNodes,
  invertCarve,
  moveNodes,
  negateNodes,
  reparentNode,
  reorderNodes,
  multi,
  removeNode,
  removeNodes,
  rootedIn,
  renameNode,
  setCameraOn,
  setGeometry,
  setGeometryOn,
  setLight,
  setLightOn,
  setMeshMaterial,
  setMaterialOn,
  setModelLanes,
  dressModel,
  wearMaterialAt,
  setNodeVisible,
  setWorld,
  setSelection,
  setShadowOn,
  setSprite,
  setSpriteOn,
  setTransform,
} from './commands'
import {
  cameraNodeFixture as camera,
  lightNodeFixture as light,
  meshNode as mesh,
  modelNodeFixture,
  spriteNodeFixture,
} from './scene-fixtures'

const sprite = (id: string) => spriteNodeFixture(id, 'pic-1')
import {
  DEFAULT_MATERIAL,
  DEFAULT_SPRITE,
  EMPTY_SCENE,
  IDENTITY_TRANSFORM,
  nodeById,
  type SceneState,
} from './sceneState'
import type { EnvironmentRef, GeometryDescriptor, Transform } from '@shared/domain/scene'
import type { CsgOperation } from '@shared/domain/csg'
import { carvedNode, groupNode } from './nodeFactory'
import { csgPartOf } from '@shared/domain/csg'
import { csgGraphOf } from '../csg/csg-fixtures'

const CUBE_SHAPE: GeometryDescriptor = { kind: 'box', width: 1, height: 1, depth: 1 }

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
    const start: SceneState = {
      ...EMPTY_SCENE,
      nodes: [mesh('a'), mesh('b'), mesh('c')],
      selectedIds: [],
    }
    const command = removeNode('b')
    const removed = command.apply(start)
    expect(removed.nodes.map(node => node.id)).toEqual(['a', 'c'])
    expect(command.revert(removed).nodes.map(node => node.id)).toEqual(['a', 'b', 'c'])
  })

  it('drops the removed node from the selection and leaves the rest of it standing', () => {
    const start: SceneState = {
      ...EMPTY_SCENE,
      nodes: [mesh('a'), mesh('b')],
      selectedIds: ['a', 'b'],
    }
    expect(removeNode('a').apply(start).selectedIds).toEqual(['b'])
  })

  it('hands the anchor back to the previous node when it removes the anchor', () => {
    const start: SceneState = {
      ...EMPTY_SCENE,
      nodes: [mesh('a'), mesh('b')],
      selectedIds: ['a', 'b'],
    }
    expect(removeNode('b').apply(start).selectedIds.at(-1)).toBe('a')
  })

  it('leaves an unknown id alone', () => {
    const start: SceneState = { ...EMPTY_SCENE, nodes: [mesh('a')], selectedIds: [] }
    expect(removeNode('ghost').apply(start)).toEqual(start)
  })
})

describe('setNodeVisible', () => {
  it('toggles visibility and comes back', () => {
    const start: SceneState = { ...EMPTY_SCENE, nodes: [mesh('a')], selectedIds: [] }
    const command = setNodeVisible('a', false)
    const hidden = command.apply(start)
    expect(hidden.nodes[0]?.visible).toBe(false)
    expect(command.revert(hidden).nodes[0]?.visible).toBe(true)
  })
})

describe('renameNode', () => {
  it('renames and comes back', () => {
    const start: SceneState = { ...EMPTY_SCENE, nodes: [mesh('a')], selectedIds: [] }
    const command = renameNode('a', 'Cube')
    const renamed = command.apply(start)
    expect(renamed.nodes[0]?.name).toBe('Cube')
    expect(command.revert(renamed).nodes[0]?.name).toBe('a')
  })
})

describe('setTransform', () => {
  it('survives being replayed through the history', () => {
    const start: SceneState = { ...EMPTY_SCENE, nodes: [mesh('a')], selectedIds: [] }
    const moved = { ...IDENTITY_TRANSFORM, position: { x: 1, y: 2, z: 3 } }
    const [after, history] = run(start, emptyHistory<SceneState>(), setTransform('a', moved))
    expect(after.nodes[0]?.transform.position).toEqual({ x: 1, y: 2, z: 3 })

    const [back] = undo(after, history)
    expect(back.nodes[0]?.transform.position).toEqual({ x: 0, y: 0, z: 0 })
  })

  it('leaves the discriminated half of the node untouched', () => {
    const start: SceneState = { ...EMPTY_SCENE, nodes: [mesh('a')], selectedIds: [] }
    const moved = { ...IDENTITY_TRANSFORM, position: { x: 5, y: 0, z: 0 } }
    const after = setTransform('a', moved).apply(start)
    const node = after.nodes[0]
    expect(node?.type).toBe('mesh')
    expect(node?.type === 'mesh' && node.geometry.kind).toBe('box')
  })

  /**
   * A held axis is refused HERE and not in the panel, which is the whole of what makes it hold:
   * the viewport gizmo and the inspector both write through this command, so anywhere else would
   * have been a padlock the handle walks straight past.
   */
  describe('an axis held still', () => {
    const held: SceneState = {
      ...EMPTY_SCENE,
      nodes: [mesh('a')],
      selectedIds: [],
      lockedAxes: [{ nodeId: 'a', channel: 'position', axis: 'y' }],
    }

    it('keeps its value while its neighbours take the move', () => {
      const after = setTransform('a', {
        ...IDENTITY_TRANSFORM,
        position: { x: 1, y: 9, z: 3 },
      }).apply(held)

      expect(after.nodes[0]?.transform.position).toEqual({ x: 1, y: 0, z: 3 })
    })

    it('holds one channel without holding the others', () => {
      const after = setTransform('a', {
        position: { x: 0, y: 9, z: 0 },
        rotation: { x: 0, y: 2, z: 0 },
        scale: { x: 4, y: 4, z: 4 },
      }).apply(held)

      expect(after.nodes[0]?.transform.rotation.y).toBe(2)
      expect(after.nodes[0]?.transform.scale.y).toBe(4)
    })

    it('holds the node it names and no other', () => {
      const two: SceneState = { ...held, nodes: [mesh('a'), mesh('b')] }
      const after = setTransform('b', {
        ...IDENTITY_TRANSFORM,
        position: { x: 0, y: 9, z: 0 },
      }).apply(two)

      expect(after.nodes[1]?.transform.position.y).toBe(9)
    })
  })

  /**
   * The defect: the viewport already refused the handle, but a typed angle still reached the
   * document — an undo entry for a screen that never moved.
   */
  describe('an angle that would show nowhere', () => {
    const turned: Transform = {
      ...IDENTITY_TRANSFORM,
      position: { x: 5, y: 0, z: 0 },
      rotation: { x: 0, y: Math.PI / 2, z: 0 },
    }

    it('is dropped off a lone sprite, and the rest of the move written', () => {
      const start: SceneState = { ...EMPTY_SCENE, nodes: [sprite('s')], selectedIds: [] }
      const after = setTransform('s', turned).apply(start)

      expect(after.nodes[0]?.transform.rotation).toEqual({ x: 0, y: 0, z: 0 })
      expect(after.nodes[0]?.transform.position).toEqual({ x: 5, y: 0, z: 0 })
    })

    it('is written on a sprite others hang from, which turning swings around it', () => {
      const start: SceneState = {
        ...EMPTY_SCENE,
        nodes: [sprite('s'), mesh('m', 's')],
        selectedIds: [],
      }
      const after = setTransform('s', turned).apply(start)

      expect(after.nodes[0]?.transform.rotation.y).toBeCloseTo(Math.PI / 2)
    })

    // The rule is read at every `apply`, never frozen when the command was built: a child added
    // between the two would otherwise keep answering for the scene the command was born in.
    it('is written on redo once a child has arrived', () => {
      const start: SceneState = { ...EMPTY_SCENE, nodes: [sprite('s')], selectedIds: [] }
      const command = setTransform('s', turned)
      command.apply(start)
      const grown = addNode(mesh('m', 's')).apply(start)

      expect(command.apply(grown).nodes[0]?.transform.rotation.y).toBeCloseTo(Math.PI / 2)
    })
  })
})

describe('setGeometry', () => {
  it('replaces the descriptor and comes back', () => {
    const start: SceneState = { ...EMPTY_SCENE, nodes: [mesh('a')], selectedIds: [] }
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
    const start: SceneState = { ...EMPTY_SCENE, nodes: [light('a')], selectedIds: [] }
    const command = setGeometry('a', {
      kind: 'sphere',
      radius: 1,
      widthSegments: 8,
      heightSegments: 6,
    })

    expect(command.apply(start)).toEqual(start)
  })
})

describe('setMeshMaterial', () => {
  it('replaces the material and comes back', () => {
    const start: SceneState = { ...EMPTY_SCENE, nodes: [mesh('a')], selectedIds: [] }
    const command = setMeshMaterial('a', {
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
    const start: SceneState = { ...EMPTY_SCENE, nodes: [mesh('a')], selectedIds: [] }
    const command = setMeshMaterial('a', { ...DEFAULT_MATERIAL, roughness: 0.5 })

    const node = command.apply(start).nodes[0]
    expect(node?.type === 'mesh' && node.geometry.kind).toBe('box')
  })
})

describe('setLight', () => {
  it('replaces the descriptor and comes back', () => {
    const start: SceneState = { ...EMPTY_SCENE, nodes: [light('a')], selectedIds: [] }
    const command = setLight('a', { kind: 'ambient', color: '#ffffff', intensity: 0.5 })

    const applied = command.apply(start)
    const node = applied.nodes[0]
    expect(node?.type === 'light' && node.light.intensity).toBe(0.5)

    const back = command.revert(applied).nodes[0]
    expect(back?.type === 'light' && back.light.intensity).toBe(1)
  })

  it('refuses to give a mesh a light', () => {
    const start: SceneState = { ...EMPTY_SCENE, nodes: [mesh('a')], selectedIds: [] }

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
  const start: SceneState = {
    ...EMPTY_SCENE,
    nodes: [mesh('a'), mesh('b'), mesh('c')],
    selectedIds: [],
  }

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
      ...EMPTY_SCENE,
      nodes: [mesh('a'), mesh('b'), mesh('c')],
      selectedIds: ['a', 'c'],
    }
    const command = removeNodes(start.nodes, ['a', 'c'])
    const applied = command.apply(start)

    expect(applied.nodes.map(node => node.id)).toEqual(['b'])
    expect(applied.selectedIds).toEqual([])
    expect(command.revert(applied).nodes.map(node => node.id)).toEqual(['a', 'b', 'c'])
  })

  /** One sweep records where each node left from, and putting them back out of ascending order
   * lands every later one a slot off — which only a scattered subtree shows. */
  it('puts a scattered subtree back at the very indices it left', () => {
    const start: SceneState = {
      ...EMPTY_SCENE,
      // The child declared BEFORE the parent it hangs from, which reparenting makes ordinary.
      nodes: [mesh('leaf', 'branch'), mesh('keep'), mesh('branch'), mesh('other')],
      selectedIds: [],
    }
    const command = removeNodes(start.nodes, ['branch'])
    const applied = command.apply(start)

    expect(applied.nodes.map(node => node.id)).toEqual(['keep', 'other'])
    expect(command.revert(applied).nodes.map(node => node.id)).toEqual([
      'leaf',
      'keep',
      'branch',
      'other',
    ])
  })

  /**
   * What `multi` of one command per node gave for free, and the single sweep took away: a delete
   * that reaches nothing must not push an entry. Otherwise ⌘Z gains a step doing nothing, and the
   * redo stack is cleared for an edit that never happened.
   */
  it('refuses a delete that reaches no node at all', () => {
    const nodes = [mesh('a')]

    expect(removeNodes(nodes, []).refuses?.({ ...EMPTY_SCENE, nodes })).toBe(true)
    expect(removeNodes(nodes, ['nowhere']).refuses?.({ ...EMPTY_SCENE, nodes })).toBe(true)
    expect(removeNodes(nodes, ['a']).refuses?.({ ...EMPTY_SCENE, nodes })).toBe(false)
  })

  /** `applySelection` hands the same array back when nothing changed, and everything watching
   * the selection re-renders on a fresh one — see `helpers/selection`. */
  it('leaves the selection untouched, by reference, when nothing selected is deleted', () => {
    const nodes = [mesh('a'), mesh('b')]
    const start: SceneState = { ...EMPTY_SCENE, nodes, selectedIds: ['b'] }

    expect(removeNodes(nodes, ['a']).apply(start).selectedIds).toBe(start.selectedIds)
  })
})

/**
 * The LAST copy is the anchor — the row an inspector reads and a gizmo lands on. The roots
 * therefore keep the order they were PICKED in: reading them in scene order moved the gizmo onto
 * the copy of a shape nobody had pointed at, and no test held either order.
 */
describe('copiesOf', () => {
  it('keeps the picked order, so the copy of the anchor is the anchor', () => {
    const nodes = [mesh('a'), mesh('b')]
    const picked = [nodes[1], nodes[0]].filter(node => node !== undefined)

    expect(copiesOf(nodes, picked).map(copy => copy.name)).toEqual(['b', 'a'])
  })
})

describe('moveNodes', () => {
  it('carries one drag of several nodes as one entry', () => {
    const start: SceneState = {
      ...EMPTY_SCENE,
      nodes: [mesh('a'), mesh('b')],
      selectedIds: ['a', 'b'],
    }
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

describe('setCameraOn', () => {
  const start: SceneState = {
    ...EMPTY_SCENE,
    nodes: [camera('a'), camera('b', { fov: 20 }), mesh('box')],
    selectedIds: ['a', 'b'],
  }

  it('writes the lens onto every selected camera, and undoes each one', () => {
    const command = setCameraOn(start.nodes, 'fov', 90)
    const applied = command.apply(start)

    const lenses = applied.nodes.map(node => (node.type === 'camera' ? node.camera.fov : null))
    expect(lenses).toEqual([90, 90, null])
    expect(command.revert(applied)).toEqual(start)
  })

  it('leaves a node of another type alone', () => {
    const applied = setCameraOn(start.nodes, 'fov', 90).apply(start)
    expect(applied.nodes[2]).toBe(start.nodes[2])
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
    const start: SceneState = { ...EMPTY_SCENE, nodes: [anchor, other], selectedIds: ['b', 'a'] }
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
    const start: SceneState = { ...EMPTY_SCENE, nodes: [anchor, ambient], selectedIds: ['b', 'a'] }
    if (anchor.type !== 'light') throw new Error('fixture is not a light')

    expect(setLightOn(start.nodes, anchor.light, 'intensity', 4).apply(start).nodes[1]).toBe(
      ambient,
    )
  })
})

describe('reorderNodes', () => {
  // The outliner reads a level off the order of `nodes`: `a`, `b`, then `c` inside `b`.
  const start: SceneState = { ...EMPTY_SCENE, nodes: [mesh('a'), mesh('b'), mesh('c', 'b')] }
  const order = (state: SceneState, parentId: string | null = null): string[] =>
    state.nodes.filter(node => node.parentId === parentId).map(node => node.id)

  it('moves a node down its own level, and puts it back', () => {
    const command = reorderNodes(['a'], null, 1)
    const moved = command.apply(start)

    expect(order(moved)).toEqual(['b', 'a'])
    expect(order(command.revert(moved))).toEqual(['a', 'b'])
  })

  it('moves a node up its own level', () => {
    expect(order(reorderNodes(['b'], null, 0).apply(start))).toEqual(['b', 'a'])
  })

  // The other half of the gesture: a row dropped between two rows of ANOTHER level changes both
  // where it hangs and where it sits.
  it('lands in another level at the place asked for', () => {
    const moved = reorderNodes(['a'], 'b', 0).apply(start)

    expect(order(moved, 'b')).toEqual(['a', 'c'])
    expect(order(moved)).toEqual(['b'])
  })

  it('takes a node back out of the group holding it', () => {
    const moved = reorderNodes(['c'], null, 0).apply(start)

    expect(order(moved)).toEqual(['c', 'a', 'b'])
    expect(order(moved, 'b')).toEqual([])
  })

  // Applied, it would close the tree on itself and every walk of it would run forever.
  it('refuses a move under its own descendant, and leaves the scene untouched', () => {
    expect(reorderNodes(['b'], 'c', 0).apply(start)).toBe(start)
  })

  it('leaves an unknown node alone', () => {
    expect(reorderNodes(['ghost'], null, 0).apply(start)).toBe(start)
  })

  /**
   * A parent ahead of its own children is the one property the rest of the engine reads the flat
   * array for. The case that breaks it is a GROUP dragged past its own children, which needs a
   * fourth node to be aimed at — `b` holds `c`, and `d` is the row it lands after.
   */
  it('carries what hangs from a group when the group moves past it', () => {
    const held: SceneState = { ...start, nodes: [...start.nodes, mesh('d')] }
    const moved = reorderNodes(['b'], null, 2).apply(held)
    const ids = moved.nodes.map(node => node.id)

    expect(order(moved)).toEqual(['a', 'd', 'b'])
    expect(order(moved, 'b')).toEqual(['c'])
    expect(ids.indexOf('b')).toBeLessThan(ids.indexOf('c'))
  })

  /**
   * 🛑 The case a command PER MEMBER gets wrong, and it is the everyday one: two rows already in
   * the receiving level, dragged past a row that sits between them. `index` counts the level once
   * BOTH have left it, so a member still in place must not be counted as a sibling by the other —
   * measured before this was one command: they landed two apart.
   */
  it('lands a batch contiguous, even at the end of the level it came from', () => {
    const five: SceneState = {
      ...EMPTY_SCENE,
      nodes: [mesh('a'), mesh('b'), mesh('c'), mesh('d'), mesh('e')],
    }
    const command = reorderNodes(['a', 'c'], null, 3)
    const moved = command.apply(five)

    expect(order(moved)).toEqual(['b', 'd', 'e', 'a', 'c'])
    expect(order(command.revert(moved))).toEqual(['a', 'b', 'c', 'd', 'e'])
  })

  it('carries the whole batch into another level, in the order given', () => {
    const moved = reorderNodes(['a', 'c'], 'b', 0).apply(start)

    expect(order(moved, 'b')).toEqual(['a', 'c'])
    expect(order(moved)).toEqual(['b'])
  })

  // It already travels inside the member carrying it, and taking it twice would put it in the
  // flat array twice.
  it('takes a member nested inside another member only once', () => {
    const moved = reorderNodes(['b', 'c'], null, 0).apply(start)

    expect(moved.nodes.map(node => node.id)).toEqual(['b', 'c', 'a'])
    expect(order(moved, 'b')).toEqual(['c'])
  })

  // The place it came from is only known once the move runs — a redo has to capture it again.
  it('captures where it came from again when it is replayed', () => {
    const command = reorderNodes(['a'], null, 1)
    const moved = command.apply(start)
    const back = command.revert(moved)

    expect(order(command.apply(back))).toEqual(['b', 'a'])
  })
})

describe('reparentNode', () => {
  const start: SceneState = { ...EMPTY_SCENE, nodes: [mesh('a'), mesh('b'), mesh('c', 'b')] }

  it('hangs a node from another, and puts it back where it was', () => {
    const command = reparentNode('a', 'b')
    const moved = command.apply(start)

    expect(nodeById(moved, 'a')?.parentId).toBe('b')
    expect(nodeById(command.revert(moved), 'a')?.parentId).toBeNull()
  })

  it('brings a node back out to the scene', () => {
    const command = reparentNode('c', null)
    expect(nodeById(command.apply(start), 'c')?.parentId).toBeNull()
  })

  // Applied, it would close the tree on itself and every walk of it would run forever.
  it('refuses a move under its own descendant, and leaves the scene untouched', () => {
    expect(reparentNode('b', 'c').apply(start)).toBe(start)
  })

  it('leaves an unknown node and a move that changes nothing alone', () => {
    expect(reparentNode('ghost', 'b').apply(start)).toBe(start)
    expect(reparentNode('c', 'b').apply(start)).toBe(start)
  })

  // The old parent is only known once the move runs — a redo has to capture it again.
  it('survives being replayed through the history', () => {
    const command = reparentNode('c', null)
    const [out, history] = run(start, emptyHistory<SceneState>(), command)
    const [back] = undo(out, history)

    expect(nodeById(back, 'c')?.parentId).toBe('b')
  })
})

describe('groupNodes', () => {
  const start: SceneState = { ...EMPTY_SCENE, nodes: [mesh('a'), mesh('b'), mesh('c', 'b')] }

  it('puts one group over the selection, and hangs it from nothing', () => {
    const grouped = groupNodes([mesh('a'), mesh('b')]).apply(start)
    const group = grouped.nodes.find(node => node.type === 'group')

    expect(group?.parentId).toBeNull()
    expect(grouped.nodes.filter(node => node.parentId === group?.id).map(node => node.id)).toEqual([
      'a',
      'b',
    ])
  })

  // A node whose own parent is selected too is already carried along by it.
  it('moves only the roots of the selection, so a subtree stays a subtree', () => {
    const chosen = [mesh('b'), mesh('c', 'b')]
    const grouped = groupNodes(chosen).apply(start)

    expect(nodeById(grouped, 'c')?.parentId).toBe('b')
  })

  it('is one entry in the history, whatever it moved', () => {
    const command = groupNodes([mesh('a'), mesh('b')])
    expect(command.revert(command.apply(start)).nodes).toEqual(start.nodes)
  })

  // Grouping nothing is reachable from the keyboard: the group must land at the scene rather
  // than hang from `undefined`.
  it('puts the group at the scene when nothing is selected', () => {
    const applied = groupNodes([]).apply(EMPTY_SCENE)

    expect(applied.nodes.find(node => node.type === 'group')?.parentId).toBeNull()
  })
})

describe('copiesOf', () => {
  // a > b, and c beside them
  const nodes = [mesh('a'), mesh('b', 'a'), mesh('c')]

  it('gives every copy an id of its own', () => {
    const copies = copiesOf(nodes, [mesh('c')])

    expect(copies).toHaveLength(1)
    expect(copies[0]?.id).not.toBe('c')
  })

  // A child still naming the original would be shared between the two: moving one would move
  // the other's child.
  it('carries a subtree whole, with its parents rewritten to the copies', () => {
    const copies = copiesOf(nodes, [nodes[0]!])

    expect(copies).toHaveLength(2)
    expect(copies[1]?.parentId).toBe(copies[0]?.id)
  })

  // What falls outside the set keeps its parent, which is what puts a copy beside its original.
  it('leaves a parent outside the copy pointing where it did', () => {
    const copies = copiesOf(nodes, [nodes[1]!])
    expect(copies[0]?.parentId).toBe('a')
  })

  it('copies a node once when both it and its parent are picked', () => {
    expect(copiesOf(nodes, [nodes[0]!, nodes[1]!])).toHaveLength(2)
  })

  it('keeps everything else of the node, so a copy looks like what it came from', () => {
    const dressed = { ...mesh('c'), name: 'Socle', visible: false }
    const [copy] = copiesOf([dressed], [dressed])

    expect(copy).toMatchObject({ name: 'Socle', visible: false, type: 'mesh' })
  })
})

describe('addNodes', () => {
  const start: SceneState = { ...EMPTY_SCENE, nodes: [mesh('a')], selectedIds: ['a'] }

  it('puts the copies in and selects them, since that is what the next gesture acts on', () => {
    const copies = copiesOf(start.nodes, start.nodes)
    const pasted = addNodes(copies).apply(start)

    expect(pasted.nodes).toHaveLength(2)
    expect(pasted.selectedIds).toEqual(copies.map(node => node.id))
  })

  it('takes them back out, and the selection with them', () => {
    const command = addNodes(copiesOf(start.nodes, start.nodes))
    const back = command.revert(command.apply(start))

    expect(back.nodes).toEqual(start.nodes)
    expect(back.selectedIds).toEqual([])
  })

  // Nothing to put down clears no selection: an empty add is a no-op, not a deselect.
  it('leaves the scene exactly as it was when given nothing', () => {
    expect(addNodes([]).apply(start)).toBe(start)
  })
})

describe('rootedIn', () => {
  const nodes = [mesh('a'), mesh('b', 'a')]

  it('cuts loose a parent the destination does not hold', () => {
    const [stray] = rootedIn(copiesOf(nodes, [nodes[1]!]), [mesh('elsewhere')])

    expect(stray?.parentId).toBeNull()
  })

  it('leaves a parent the destination does hold alone', () => {
    const [carried] = rootedIn(copiesOf(nodes, [nodes[1]!]), nodes)

    expect(carried?.parentId).toBe('a')
  })

  // The copies name each other: a parent inside the set is held by the paste itself.
  it('keeps a parent that comes along in the same paste', () => {
    const copies = rootedIn(copiesOf(nodes, [nodes[0]!]), [])

    expect(copies[1]?.parentId).toBe(copies[0]?.id)
  })
})

describe('setSpriteOn', () => {
  const start: SceneState = {
    ...EMPTY_SCENE,
    nodes: [sprite('s1'), sprite('s2'), mesh('m1')],
    selectedIds: [],
  }

  it('writes the change onto every sprite of the selection, and comes back', () => {
    const command = setSpriteOn(start.nodes, { opacity: 0.5 })
    const faded = command.apply(start)

    expect(faded.nodes.map(node => (node.type === 'sprite' ? node.sprite.opacity : null))).toEqual([
      0.5,
      0.5,
      null,
    ])
    expect(command.revert(faded)).toEqual(start)
  })

  // A mesh has no sprite to write into: the union is what forbids it, and so does the command.
  it('leaves everything that is not a sprite alone', () => {
    const applied = setSpriteOn(start.nodes, { opacity: 0.5 }).apply(start)

    expect(applied.nodes[2]).toEqual(start.nodes[2])
  })

  it('leaves the fields it was not given alone', () => {
    const applied = setSpriteOn([start.nodes[0]!], { opacity: 0.2 }).apply(start)
    const node = applied.nodes[0]

    expect(node?.type === 'sprite' && node.sprite.map).toEqual({ assetId: 'pic-1' })
  })
})

describe('setWorld', () => {
  const sky: EnvironmentRef = { kind: 'skybox', assetId: 'sky-1' }

  it('swaps what lights the scene, and comes back', () => {
    const command = setWorld({ environment: sky })
    const lit = command.apply(EMPTY_SCENE)

    expect(lit.world.environment).toEqual(sky)
    expect(command.revert(lit).world.environment).toEqual({ kind: 'studio' })
  })

  // A patch, so a preset writing five fields and a slider writing one are the same call — and a
  // field this build does not know is left exactly as the file spelled it.
  it('leaves the fields it was not given alone', () => {
    const lit = setWorld({ exposure: 1.4 }).apply({
      ...EMPTY_SCENE,
      world: { ...EMPTY_SCENE.world, environment: sky },
    })

    expect(lit.world.exposure).toBe(1.4)
    expect(lit.world.environment).toEqual(sky)
  })

  // Choosing a sky is a decision about the document, not a way of looking at it.
  it('leaves the nodes and the selection alone', () => {
    const start = { ...EMPTY_SCENE, nodes: [mesh('a')], selectedIds: ['a'] }
    const lit = setWorld({ environment: sky }).apply(start)

    expect(lit.nodes).toBe(start.nodes)
    expect(lit.selectedIds).toBe(start.selectedIds)
  })
})

describe('batch', () => {
  const start: SceneState = {
    ...EMPTY_SCENE,
    nodes: [mesh('a'), mesh('b'), light('c')],
    selectedIds: [],
  }

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

  it('refuses only when every target refuses, so one node still worth moving makes an entry', () => {
    const same = batch('rename', start.nodes, node => renameNode(node.id, node.name))
    const one = batch('rename', start.nodes, node =>
      renameNode(node.id, node.id === 'a' ? 'other' : node.name),
    )

    expect(same.refuses?.(start)).toBe(true)
    expect(one.refuses?.(start)).toBe(false)
  })

  it('refuses a batch that reaches nothing, rather than pushing an entry doing nothing', () => {
    expect(batch('rename', start.nodes, () => null).refuses?.(start)).toBe(true)
  })

  it('never refuses an edit that has no opinion, however many nodes it covers', () => {
    const command = batch('material', start.nodes, node =>
      setMeshMaterial(node.id, DEFAULT_MATERIAL),
    )
    expect(command.refuses?.(start)).toBe(false)
  })

  it('writes in scene order, whatever order the targets came in', () => {
    const applied = batch('rename', [...start.nodes].reverse(), node =>
      renameNode(node.id, `${node.id}!`),
    ).apply(start)

    expect(applied.nodes.map(node => node.id)).toEqual(['a', 'b', 'c'])
    expect(applied.nodes.map(node => node.name)).toEqual(['a!', 'b!', 'c!'])
  })

  it('hands back the state itself when nothing was written', () => {
    expect(batch('rename', start.nodes, () => null).apply(start)).toBe(start)
  })

  it('leaves the scene alone for a target it does not hold, forwards and back', () => {
    const command = batch('rename', [{ id: 'ghost' }], target => renameNode(target.id, 'x'))
    expect(command.apply(start)).toBe(start)
    expect(command.revert(start)).toBe(start)
  })

  it('hands back the same selection, so nothing watching it re-renders', () => {
    const picked: SceneState = { ...start, selectedIds: ['a'] }
    const applied = batch('rename', picked.nodes, node => renameNode(node.id, 'x')).apply(picked)
    expect(applied.selectedIds).toBe(picked.selectedIds)
  })

  it('recaptures as it is replayed, so a redo undoes to where the redo started', () => {
    const command = batch('rename', start.nodes, node => renameNode(node.id, 'once'))
    const again = command.apply(command.revert(command.apply(start)))
    expect(command.revert(again).nodes.map(node => node.name)).toEqual(['a', 'b', 'c'])
  })
})

/**
 * The defensive halves. A command is built before it knows what it will meet: the node may be
 * gone, or be of another type. Each of those must leave the state exactly as it was — an edit
 * written onto a node of the wrong type produces a document that no longer loads.
 */
describe('an edit that meets nothing it can act on', () => {
  const scene = { ...EMPTY_SCENE, nodes: [mesh('a'), light('l'), sprite('s')] }

  const refused: [string, Command<SceneState>][] = [
    ['renameNode on a node that is gone', renameNode('missing', 'x')],
    ['setSprite on a mesh', setSprite('a', DEFAULT_SPRITE)],
  ]

  for (const [name, command] of refused) {
    it(`leaves the scene alone: ${name}`, () => {
      expect(command.apply(scene)).toBe(scene)
    })
  }
})

// Redo replays a command; a revert that never ran must not invent a previous state to go back to.
describe('a revert asked for before its apply', () => {
  const scene = { ...EMPTY_SCENE, nodes: [mesh('a'), light('l'), sprite('s')] }

  const untouched: [string, Command<SceneState>][] = [
    ['removeNode', removeNode('a')],
    ['renameNode', renameNode('a', 'x')],
    [
      'setGeometry',
      setGeometry('a', { kind: 'sphere', radius: 1, widthSegments: 8, heightSegments: 6 }),
    ],
    ['setLight', setLight('l', { kind: 'ambient', color: '#fff', intensity: 2 })],
    ['setSprite', setSprite('s', DEFAULT_SPRITE)],
    ['reparentNode', reparentNode('a', 'l')],
    ['reorderNodes', reorderNodes(['a'], null, 0)],
    ['setWorld', setWorld({ environment: { kind: 'skybox', assetId: 'sky-1' } })],
  ]

  for (const [name, command] of untouched) {
    it(`gives ${name} back the very state it was handed`, () => {
      expect(command.revert(scene)).toBe(scene)
    })
  }
})

describe('setShadowOn', () => {
  const scene = { ...EMPTY_SCENE, nodes: [mesh('a'), light('l'), sprite('s')] }

  // The inspector hides the row; the command must refuse it too, or the flag lands in the
  // document and in the history for a node the renderer will never read it from.
  it('skips what catches no shadow', () => {
    const applied = setShadowOn(scene.nodes, { receiveShadow: true }).apply(scene)

    expect(applied.nodes.map(node => node.receiveShadow)).toEqual([true, false, false])
  })

  it('skips what throws no shadow', () => {
    const applied = setShadowOn(scene.nodes, { castShadow: true }).apply(scene)

    expect(applied.nodes.map(node => node.castShadow)).toEqual([true, false, false])
  })
})

describe('an edit spread over a selection', () => {
  const scene = { ...EMPTY_SCENE, nodes: [mesh('a'), light('l')] }

  it('writes a geometry field only onto the meshes built from the same primitive', () => {
    const sphere = mesh('b')
    sphere.geometry = { kind: 'sphere', radius: 1, widthSegments: 8, heightSegments: 6 }
    const nodes = [...scene.nodes, sphere]

    const applied = setGeometryOn(
      nodes,
      { kind: 'box', width: 1, height: 1, depth: 1 },
      'width',
      4,
    ).apply({ ...EMPTY_SCENE, nodes })

    expect(
      applied.nodes.map(node => (node.type === 'mesh' ? node.geometry.kind : node.type)),
    ).toEqual(['box', 'light', 'sphere'])
    expect(applied.nodes[2]).toEqual(sphere)
  })

  it('writes a material field onto the meshes and nothing else', () => {
    const applied = setMaterialOn(scene.nodes, { color: '#ff0000' }).apply(scene)

    expect(applied.nodes[0]?.type === 'mesh' && applied.nodes[0].material.color).toBe('#ff0000')
    expect(applied.nodes[1]).toBe(scene.nodes[1])
  })
})

describe('dressModel', () => {
  const withModel = (): SceneState => ({ ...EMPTY_SCENE, nodes: [modelNodeFixture('m')] })

  const dressOf = (state: SceneState) => {
    const node = nodeById(state, 'm')
    return node?.type === 'model' ? node.model.dress : undefined
  }

  const wornBy = (state: SceneState, slot = 0) => wornMaterials(dressOf(state))[slot]

  it('writes the reference and gives it back on undo', () => {
    const before = withModel()
    const applied = wearMaterialAt('m', 0, 'mat-1')

    const after = applied.apply(before)
    expect(wornBy(after)).toBe('mat-1')
    expect(dressOf(applied.revert(after))).toBeUndefined()
  })

  // No dress at all is « the file's own maps », which a document should not carry a field to say.
  it('drops the field when the dress is taken off', () => {
    const dressed = wearMaterialAt('m', 0, 'mat-1').apply(withModel())

    expect(dressOf(dressModel('m', null).apply(dressed))).toBeUndefined()
  })

  // The whole point of the union: a model covered by a picture wears no material, and the other
  // way round. Two fields would have let a switch leave the old one behind, worn by nobody.
  it('cannot wear a picture and a material at once', () => {
    const dressed = wearMaterialAt('m', 0, 'mat-1').apply(withModel())
    const covered = dressModel('m', { kind: 'image', assetId: 'pic-1' }).apply(dressed)

    expect(dressOf(covered)).toEqual({ kind: 'image', assetId: 'pic-1' })
    expect(wornMaterials(dressOf(covered))).toEqual([])
  })

  // A car is a body, a glass and a set of tyres: naming the second must not name the first.
  it('names one slot without filling the ones before it', () => {
    const dressed = wearMaterialAt('m', 2, 'mat-3').apply(withModel())

    expect(wornMaterials(dressOf(dressed))).toEqual(['', '', 'mat-3'])
  })

  // Emptying a row is not removing it: the list is what the user built, and a row that vanished
  // under the finger that cleared it is a gesture nobody asked for.
  it('keeps a slot that is emptied', () => {
    const two = wearMaterialAt('m', 1, 'mat-2').apply(
      wearMaterialAt('m', 0, 'mat-1').apply(withModel()),
    )

    expect(wornMaterials(dressOf(wearMaterialAt('m', 1, '').apply(two)))).toEqual(['mat-1', ''])
  })

  // Both edits write the same reference: rebuilding it from `assetId` alone dropped the other.
  it('leaves the lanes of the model alone, and is left alone by them', () => {
    const lane = clipLane('main', [embeddedClip('c1', 'run', { speed: 2 })])
    const blocked = setModelLanes('m', [lane]).apply(withModel())
    const dressed = wearMaterialAt('m', 0, 'mat-1').apply(blocked)

    const node = nodeById(dressed, 'm')
    expect(node?.type === 'model' && node.model.lanes).toEqual([lane])
    expect(wornBy(setModelLanes('m', []).apply(dressed))).toBe('mat-1')
  })

  // One empty lane is exactly what the band shows a model that has never played anything, so
  // writing it says nothing the default does not.
  it('holds a lane the user added even while nothing has been dropped in it', () => {
    const lanes = [clipLane('main'), clipLane('second')]
    const node = nodeById(setModelLanes('m', lanes).apply(withModel()), 'm')

    expect(node?.type === 'model' && node.model.lanes).toEqual(lanes)

    const alone = nodeById(setModelLanes('m', [clipLane('main')]).apply(withModel()), 'm')
    expect(alone?.type === 'model' && 'lanes' in alone.model).toBe(false)
  })

  it('drops the field when the last lane goes, so a rest pose says nothing at all', () => {
    const blocked = setModelLanes('m', [clipLane('main', [embeddedClip('c1', 'run')])]).apply(
      withModel(),
    )
    const stopped = setModelLanes('m', []).apply(blocked)

    const node = nodeById(stopped, 'm')
    expect(node?.type === 'model' && 'lanes' in node.model).toBe(false)
  })
})

describe('carveNodes', () => {
  // 2.4 of matter against the cube's 1, and a bounding box twelve times bigger: the shape the
  // election has to get right, and the one it would get wrong on the box alone.
  const wall = () => ({
    ...mesh('wall'),
    name: 'Wall',
    geometry: { kind: 'box', width: 4, height: 3, depth: 0.2 } satisfies GeometryDescriptor,
  })
  const cube = (x: number) => ({
    ...mesh('cube'),
    transform: { ...IDENTITY_TRANSFORM, position: { x, y: 0, z: 0 } },
  })

  const carved = (picked: SceneState['nodes'], operation: CsgOperation = 'subtract') => {
    const command = carveNodes(picked, operation, picked)
    if (!command) throw new Error('the cut was refused')
    return command.apply({ ...EMPTY_SCENE, nodes: picked })
  }

  const solidOf = (picked: SceneState['nodes'], operation: CsgOperation = 'subtract') => {
    const solid = carved(picked, operation).nodes[0]
    if (solid?.type !== 'carved') throw new Error('the cut produced no solid')
    return solid
  }

  it('leaves one solid where the two shapes were', () => {
    const next = carved([wall(), cube(1)])

    expect(next.nodes).toHaveLength(1)
    expect(next.nodes[0]?.type).toBe('carved')
  })

  it('keeps the matter name and placement, so a wall gains a window', () => {
    const matter = {
      ...wall(),
      transform: { ...IDENTITY_TRANSFORM, position: { x: 7, y: 0, z: 0 } },
    }
    const solid = carved([matter, cube(7)]).nodes[0]

    expect(solid?.name).toBe('Wall')
    expect(solid?.transform.position.x).toBe(7)
  })

  it('refuses a selection nothing can be cut out of', () => {
    expect(carveNodes([wall()], 'subtract', [wall()])).toBeNull()
  })

  // The reason `CsgPart` carries a material at all: welding a red cube to a blue sphere and
  // separating them must not hand both back in one colour.
  it('gives each shape back the colour it wore before the fold', () => {
    const red = { ...wall(), material: { ...DEFAULT_MATERIAL, color: '#ff0000' } }
    const blue = { ...cube(1), material: { ...DEFAULT_MATERIAL, color: '#0000ff' } }
    const solid = carved([red, blue]).nodes[0]
    if (solid?.type !== 'carved') throw new Error('the cut produced no solid')

    const back = separateNode(solid).apply({ ...EMPTY_SCENE, nodes: [solid] })
    const colours = back.nodes.map(node => (node.type === 'mesh' ? node.material.color : null))

    expect(colours).toEqual(['#ff0000', '#0000ff'])
  })

  it('gives back the very shapes it folded in, still where they stood', () => {
    const solid = solidOf([wall(), cube(1)])
    const back = separateNode(solid).apply({ ...EMPTY_SCENE, nodes: [solid] })

    expect(back.nodes).toHaveLength(2)
    expect(back.nodes.map(node => node.type)).toEqual(['mesh', 'mesh'])
    expect(back.nodes[1]?.transform.position.x).toBeCloseTo(1)
  })

  /** Two shapes, one union, and the order of the clicks says nothing about which is which. */
  it('folds to the same solid whichever shape was clicked first', () => {
    const [big, small] = [wall(), cube(1)]

    expect(solidOf([small, big]).carved).toEqual(solidOf([big, small]).carved)
    expect(solidOf([small, big]).name).toBe('Wall')
  })

  /** Roblox's Negate: what is marked is a tool, whatever else is picked and whatever its size. */
  it('carves the marked shape out, even when the marked one is the bigger', () => {
    const solid = solidOf([{ ...wall(), negative: true }, cube(1)])

    expect(solid.name).toBe('cube')
    expect(solid.carved.steps[0]?.part.name).toBe('Wall')
  })

  /** A union holding a negative IS a piercing — how Roblox spells a subtraction, and the same
   * result: no Percer button is needed for the gesture to run the right way. */
  it('pierces rather than welds when the selection holds a marked shape', () => {
    const solid = solidOf([wall(), { ...cube(1), negative: true }], 'unite')

    expect(solid.name).toBe('Wall')
    expect(solid.carved.steps[0]?.operation).toBe('subtract')
  })

  /**
   * What makes the round trip idle: separate a solid, fold the same selection again, and the same
   * solid comes back — whichever button is pressed, because the marks travelled with the brushes.
   */
  it('gives a subtracted brush back marked, so folding it again cuts the same way', () => {
    const solid = solidOf([wall(), cube(1)])
    const back = separateNode(solid).apply({ ...EMPTY_SCENE, nodes: [solid] })

    expect(back.nodes.map(node => (node.type === 'mesh' ? node.negative === true : null))).toEqual([
      false,
      true,
    ])
    expect(carveNodes(back.nodes, 'unite', back.nodes)).not.toBeNull()
  })
})

/**
 * The one gesture that repairs a fold which ran backwards — no undo, and nothing to understand.
 * The election weighs matter, and a generous tool can out-weigh the thin wall it pierces.
 */
describe('invertCarve', () => {
  const wall = () => ({
    ...mesh('wall'),
    name: 'Wall',
    geometry: { kind: 'box', width: 4, height: 3, depth: 0.2 } satisfies GeometryDescriptor,
  })
  const cube = () => ({ ...mesh('cube'), name: 'Cube' })

  const folded = () => {
    const picked = [wall(), cube()]
    const command = carveNodes(picked, 'subtract', picked)
    if (!command) throw new Error('the cut was refused')
    const state = command.apply({ ...EMPTY_SCENE, nodes: picked })
    const solid = state.nodes[0]
    if (solid?.type !== 'carved') throw new Error('the cut produced no solid')
    return { solid, state }
  }

  it('swaps the matter and the tool, in one command', () => {
    const { solid, state } = folded()
    expect(solid.name).toBe('Wall')

    const flipped = invertCarve(solid, state.nodes)
    if (!flipped) throw new Error('the solid carries a tool')
    const after = flipped.apply(state)
    const made = after.nodes.find(node => node.type === 'carved')

    expect(after.nodes).toHaveLength(1)
    expect(made?.name).toBe('Cube')
    expect(made?.type === 'carved' && made.carved.steps[0]?.part.name).toBe('Wall')
  })

  /** Pressed twice, a hand has to land back where it started — or the button is a trap. */
  it('gives the first solid back when it is run again', () => {
    const { solid, state } = folded()
    const once = invertCarve(solid, state.nodes)?.apply(state)
    const flipped = once?.nodes.find(node => node.type === 'carved')
    if (flipped?.type !== 'carved' || !once) throw new Error('the first flip was refused')

    const twice = invertCarve(flipped, once.nodes)?.apply(once)
    expect(twice?.nodes.find(node => node.type === 'carved')?.name).toBe('Wall')
  })

  it('is taken back by one undo', () => {
    const { solid, state } = folded()
    const flipped = invertCarve(solid, state.nodes)
    if (!flipped) throw new Error('the solid carries a tool')

    expect(flipped.revert(flipped.apply(state)).nodes.map(node => node.id)).toEqual(
      state.nodes.map(node => node.id),
    )
  })

  it('refuses a solid of one brush, which has no other way to run', () => {
    const only = carvedNode(csgGraphOf(csgPartOf('Alone', CUBE_SHAPE, DEFAULT_MATERIAL)))
    if (only.type !== 'carved') throw new Error('a solid')
    expect(invertCarve(only, [only])).toBeNull()
  })
})

describe('negateNodes', () => {
  const shapes = () => [mesh('a'), mesh('b')]
  const marked = (state: SceneState) =>
    state.nodes.map(node => (node.type === 'mesh' ? node.negative === true : null))

  const run = (nodes: SceneState['nodes']) => negateNodes(nodes).apply({ ...EMPTY_SCENE, nodes })

  it('marks a selection nothing of which is marked', () => {
    expect(marked(run(shapes()))).toEqual([true, true])
  })

  /** One button for both, which is what Roblox's Negate is — and the way back out of a mark. */
  it('takes the mark off a selection wholly marked', () => {
    const already = shapes().map(node => ({ ...node, negative: true }))
    expect(marked(run(already))).toEqual([false, false])
  })

  it('marks the rest rather than unmarking, when only part of the selection is marked', () => {
    const [one, other] = shapes()
    if (!one || !other) throw new Error('two shapes')
    expect(marked(run([{ ...one, negative: true }, other]))).toEqual([true, true])
  })

  it('leaves a node carrying no shape alone', () => {
    const nodes = [mesh('a'), groupNode()]
    const next = negateNodes(nodes).apply({ ...EMPTY_SCENE, nodes })

    expect(next.nodes[1]).toEqual(nodes[1])
  })

  it('refuses a selection carrying no shape at all, rather than costing an empty undo', () => {
    expect(negateNodes([groupNode()]).refuses?.(EMPTY_SCENE)).toBe(true)
  })

  /**
   * Each node back to ITS OWN mark, not to a shared default: one sweep writes the whole selection
   * now — 3.9 ms for 500 shapes in a 40 000-node scene against 219 ms one command per node — and
   * a revert that forgot which of them was already marked would be the price of that sweep.
   */
  it('gives every shape back the mark it wore, and not a shared one', () => {
    const [one, other] = shapes()
    if (!one || !other) throw new Error('two shapes')
    const nodes = [{ ...one, negative: true }, other]
    const command = negateNodes(nodes)
    const state = { ...EMPTY_SCENE, nodes }

    expect(marked(command.apply(state))).toEqual([true, true])
    expect(marked(command.revert(command.apply(state)))).toEqual([true, false])
  })
})
