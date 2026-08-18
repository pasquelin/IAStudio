import { describe, expect, it } from 'vitest'
import { clipLane, embeddedClip } from '@shared/domain/scene'
import type { Rig, RigBone } from '@shared/domain/rig'
import { rigFit } from './rigFit'
import { emptyHistory, run, undo, type Command } from '../core/history'
import {
  addNode,
  addNodes,
  addRigBone,
  addRigHands,
  batch,
  copiesOf,
  groupNodes,
  moveNodes,
  reparentNode,
  multi,
  removeNode,
  removeNodes,
  removeRigBone,
  rootedIn,
  renameNode,
  renameRigBone,
  setCameraOn,
  setGeometry,
  setGeometryOn,
  setLight,
  setLightOn,
  setMeshMaterial,
  setMaterialOn,
  setModelLanes,
  setModelRig,
  setModelTextures,
  setNodeVisible,
  setRigBoneRole,
  setEnvironment,
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
  STANDING_BOUNDS,
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
import type { EnvironmentRef, Transform } from '@shared/domain/scene'

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

describe('setEnvironment', () => {
  const sky: EnvironmentRef = { kind: 'skybox', assetId: 'sky-1' }

  it('swaps what lights the scene, and comes back', () => {
    const command = setEnvironment(sky)
    const lit = command.apply(EMPTY_SCENE)

    expect(lit.environment).toEqual(sky)
    expect(command.revert(lit).environment).toEqual({ kind: 'studio' })
  })

  // Choosing a sky is a decision about the document, not a way of looking at it.
  it('leaves the nodes and the selection alone', () => {
    const start = { ...EMPTY_SCENE, nodes: [mesh('a')], selectedIds: ['a'] }
    const lit = setEnvironment(sky).apply(start)

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
    ['setEnvironment', setEnvironment({ kind: 'skybox', assetId: 'sky-1' })],
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

describe('setModelTextures', () => {
  const withModel = (): SceneState => ({ ...EMPTY_SCENE, nodes: [modelNodeFixture('m')] })

  const texturesOf = (state: SceneState) => {
    const node = nodeById(state, 'm')
    return node?.type === 'model' ? node.model.textures : undefined
  }

  it('writes the overrides and gives them back on undo', () => {
    const before = withModel()
    const applied = setModelTextures('m', { map: { assetId: 'tex-1' } })

    const after = applied.apply(before)
    expect(texturesOf(after)).toEqual({ map: { assetId: 'tex-1' } })
    expect(texturesOf(applied.revert(after))).toBeUndefined()
  })

  // An empty set is « the file's own maps », which a document should not carry a field to say.
  it('drops the field when the last override goes', () => {
    const dressed = setModelTextures('m', { map: { assetId: 'tex-1' } }).apply(withModel())

    expect(texturesOf(setModelTextures('m', {}).apply(dressed))).toBeUndefined()
  })

  // Both edits write the same reference: rebuilding it from `assetId` alone dropped the other.
  it('leaves the lanes of the model alone, and is left alone by them', () => {
    const lane = clipLane('main', [embeddedClip('c1', 'run', { speed: 2 })])
    const blocked = setModelLanes('m', [lane]).apply(withModel())
    const dressed = setModelTextures('m', { map: { assetId: 'tex-1' } }).apply(blocked)

    const node = nodeById(dressed, 'm')
    expect(node?.type === 'model' && node.model.lanes).toEqual([lane])
    expect(texturesOf(setModelLanes('m', []).apply(dressed))).toEqual({
      map: { assetId: 'tex-1' },
    })
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

  it('puts a skeleton on a model, and takes it back off', () => {
    const rig: Rig = {
      origin: 'local',
      bones: [{ name: 'Hips', parent: null, rest: IDENTITY_TRANSFORM }],
    }
    const rigged = setModelRig('m', rig).apply(withModel())

    const node = nodeById(rigged, 'm')
    expect(node?.type === 'model' && node.model.rig).toEqual(rig)

    const bare = nodeById(setModelRig('m', null).apply(rigged), 'm')
    expect(bare?.type === 'model' && 'rig' in bare.model).toBe(false)
  })
})

describe('editing a skeleton bone by bone', () => {
  const withModel = (): SceneState => ({ ...EMPTY_SCENE, nodes: [modelNodeFixture('m')] })

  const bone = (name: string, parent: string | null, role?: RigBone['role']): RigBone => ({
    name,
    parent,
    rest: IDENTITY_TRANSFORM,
    ...(role ? { role } : {}),
  })

  const ARM: Rig = {
    origin: 'local',
    bones: [bone('Hips', null, 'Hips'), bone('Elbow', 'Hips'), bone('Wrist', 'Elbow')],
  }

  const rigged = (): SceneState => setModelRig('m', ARM).apply(withModel())

  const bonesOf = (state: SceneState): readonly RigBone[] => {
    const node = nodeById(state, 'm')
    if (node?.type !== 'model' || !node.model.rig) throw new Error('the fixture rigs one model')
    return node.model.rig.bones
  }

  it('hangs a bone where it was asked to', () => {
    const next = addRigBone('m', bone('Thumb', 'Wrist')).apply(rigged())

    expect(bonesOf(next).at(-1)).toMatchObject({ name: 'Thumb', parent: 'Wrist' })
  })

  // Refused whole rather than written half: a rig the reader drops would take the model with it
  // on the next open, and nothing before then would say so.
  it('writes nothing at all when the edit would break the rig', () => {
    const next = addRigBone('m', bone('Thumb', 'Nowhere')).apply(rigged())

    expect(bonesOf(next)).toEqual(ARM.bones)
  })

  it('gives a removed bone’s children its own parent', () => {
    const next = removeRigBone('m', 'Elbow').apply(rigged())

    expect(bonesOf(next).map(one => one.name)).toEqual(['Hips', 'Wrist'])
    expect(bonesOf(next)[1]?.parent).toBe('Hips')
  })

  it('carries the children over a rename', () => {
    const next = renameRigBone('m', 'Elbow', 'LeftLowerArm').apply(rigged())

    expect(bonesOf(next).map(one => one.parent)).toEqual([null, 'Hips', 'LeftLowerArm'])
  })

  it('assigns a role, and takes it back off', () => {
    const named = setRigBoneRole('m', 'Wrist', 'LeftHand').apply(rigged())
    expect(bonesOf(named)[2]?.role).toBe('LeftHand')

    expect(bonesOf(setRigBoneRole('m', 'Wrist', null).apply(named))[2]?.role).toBeUndefined()
  })

  // The weights are not recomputed here: the engine re-binds whenever `model.rig` changes, and
  // an edit that wrote the same array back would leave a model wearing the previous skinning.
  it('hands the engine a rig it can tell apart from the one before', () => {
    const next = setRigBoneRole('m', 'Wrist', 'LeftHand').apply(rigged())
    const node = nodeById(next, 'm')

    expect(node?.type === 'model' && node.model.rig).not.toBe(ARM)
  })

  it('gives the rig back exactly as it was on an undo', () => {
    const command = removeRigBone('m', 'Elbow')
    const before = rigged()

    expect(bonesOf(command.revert(command.apply(before)))).toEqual(ARM.bones)
  })

  it('lays the thirty finger bones on the hands a rig holds', () => {
    const withHands = addRigHands('m').apply(
      setModelRig('m', rigFit(STANDING_BOUNDS)).apply(withModel()),
    )

    expect(bonesOf(withHands)).toHaveLength(22 + 30)
  })

  it('lays no finger on a rig that names no hand', () => {
    expect(bonesOf(addRigHands('m').apply(rigged()))).toEqual(ARM.bones)
  })
})
