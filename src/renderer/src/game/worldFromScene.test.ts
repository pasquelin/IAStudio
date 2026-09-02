import { describe, expect, it } from 'vitest'
import { newComponent, withComponentField } from '@shared/domain/componentRegistry'
import { DEFAULT_PLAY } from '@shared/domain/scene'
import { IDENTITY_TRANSFORM } from '@shared/domain/transform'
import { createExportHost } from '@game/host/exportHost'
import { notedPhysics, type NotedPhysics } from '@game/physics/physics-fixtures'
import type { GameApi } from '@game/api/gameApi'
import { meshNode } from '@/engines/scene/scene-fixtures'
import { EMPTY_SCENE, type SceneState } from '@/engines/scene/sceneState'
import { worldFromScene } from './worldFromScene'

const ports = (physics?: NotedPhysics): GameApi => ({
  ...createExportHost({
    input: new EventTarget(),
    player: { id: 'p1', name: 'Alba', local: true },
    files: {},
  }),
  ...(physics ? { physics } : {}),
})

const scene = (): SceneState => ({
  ...EMPTY_SCENE,
  nodes: [
    { ...meshNode('a'), name: 'Plate-forme', components: [newComponent('Movement')] },
    meshNode('b'),
  ],
})

describe('the edit state, translated into something that runs', () => {
  it('carries every object, with its name and what it does', () => {
    const world = worldFromScene('doc-1', scene(), ports())

    expect([...world.entities.all()].map(entity => entity.id)).toEqual(['a', 'b'])
    expect(world.entities.get('a')?.name).toBe('Plate-forme')
    expect(world.entities.get('a')?.components).toEqual([newComponent('Movement')])
    expect([...world.entities.withComponent('Movement')].map(one => one.id)).toEqual(['a'])
  })

  /**
   * 🛑 The whole safety of Play Mode. A world writing positions in place would edit the scene the
   * user is editing, and STOP would have something to restore — which is exactly what it must not.
   */
  it('copies every vector, so a step cannot reach the document', () => {
    const state = scene()
    const world = worldFromScene('doc-1', state, ports())
    const entity = world.entities.get('a')
    if (!entity) throw new Error('no entity')

    entity.transform.position.y = 42
    const held = entity.components[0]
    if (held) Object.assign(held, { speed: 99 })

    expect(state.nodes[0]?.transform.position.y).toBe(0)
    // The components too, and not by a spread: a shallow copy leaves the document's own objects
    // in the world, where a system writing into one edits the scene with no store action at all.
    expect(state.nodes[0]?.components).toEqual([newComponent('Movement')])
  })

  /** Written into documents since 20/08 and read by nothing until the controller arrived. */
  it('carries how the scene says it is walked', () => {
    const state = {
      ...scene(),
      world: { ...EMPTY_SCENE.world, play: { ...DEFAULT_PLAY, gravity: 9.81 } },
    }

    expect(worldFromScene('doc-1', state, ports()).play.gravity).toBe(9.81)
  })

  /**
   * The scene's floor is not a node, so it is no entity — and a game whose ground nobody stands
   * on is the first thing anybody tries.
   */
  it('gives the scene ground a body of its own when it is shown', () => {
    const physics = notedPhysics()
    const ground = { ...EMPTY_SCENE.world.ground, visible: true, size: 40 }
    const state = { ...scene(), world: { ...EMPTY_SCENE.world, ground } }

    worldFromScene('doc-1', state, ports(physics)).step(1 / 60)

    const floor = physics.added.find(body => body.body === 'world.ground')
    expect(floor?.kind).toBe('fixed')
    expect(floor?.shape.kind === 'cuboid' ? floor.shape.hx : 0).toBe(20)
  })

  it('gives no ground to a scene that shows none', () => {
    const physics = notedPhysics()

    worldFromScene('doc-1', scene(), ports(physics)).step(1 / 60)

    expect(physics.added).toEqual([])
  })

  /**
   * 🛑 An entity's transform is LOCAL and the physics composes no parent — so the body goes in at
   * its COMPOSED place. Left out, a whole set tidied under a group was solid to nobody.
   */
  it('puts a node hanging from another into the physics, at its composed place', () => {
    const physics = notedPhysics()
    const held = ports(physics)
    const parent = {
      ...meshNode('parent'),
      transform: { ...IDENTITY_TRANSFORM, position: { x: 10, y: 0, z: 0 } },
      components: [newComponent('Collider')],
    }
    const child = {
      ...meshNode('child', 'parent'),
      name: 'Caisse',
      transform: { ...IDENTITY_TRANSFORM, position: { x: 0, y: 2, z: 0 } },
      components: [newComponent('Collider')],
    }

    worldFromScene('doc-1', { ...scene(), nodes: [parent, child] }, held).step(1 / 60)

    expect(physics.added.map(body => body.body)).toEqual(['parent', 'child'])
    expect(physics.added[1]?.transform.position).toMatchObject({ x: 10, y: 2, z: 0 })
    expect(held.log.recent()).toEqual([])
  })

  /**
   * 🛑 The THIRD traversal, and the one a first pass missed: a kinematic body is built at its
   * composed place and then PLACED every step. Placed raw, a platform under a group jumped to its
   * local place on the first step — and `poses` skips a kinematic, so nothing brought it back.
   */
  it('places a kinematic body under a group at its composed place, every step', () => {
    const physics = notedPhysics()
    const held = ports(physics)
    const group = {
      ...meshNode('group'),
      transform: { ...IDENTITY_TRANSFORM, position: { x: 5, y: 0, z: 0 } },
    }
    const platform = {
      ...meshNode('lift', 'group'),
      transform: { ...IDENTITY_TRANSFORM, position: { x: 0, y: 1, z: 0 } },
      components: [
        newComponent('Collider'),
        withComponentField(newComponent('RigidBody'), 'kind', 'kinematic'),
      ],
    }

    worldFromScene('doc-1', { ...scene(), nodes: [group, platform] }, held).step(1 / 60)

    expect(physics.placed.map(pose => pose.position)).toMatchObject([{ x: 5, y: 1, z: 0 }])
  })

  it('names the document it came from, so an entity can be referenced in full', () => {
    expect(worldFromScene('doc-1', scene(), ports()).scene).toEqual({
      kind: 'document',
      id: 'doc-1',
    })
  })
})

/**
 * 🛑 `createHierarchy` reads the DOCUMENT's nodes while the entities hold copies, so a parent the
 * game moves is composed from where it stood when Play began.
 */
describe('a body hanging from a parent the game moves', () => {
  it('is placed where the parent stands NOW, not where the scene left it', () => {
    const lift = {
      ...meshNode('lift'),
      transform: { ...IDENTITY_TRANSFORM, position: { x: 0, y: 0, z: 0 } },
      components: [
        { ...newComponent('Movement'), axis: 'y', distance: 10, speed: 10, loop: 'pingPong' },
      ],
    }
    const rider = {
      ...meshNode('rider'),
      parentId: lift.id,
      transform: { ...IDENTITY_TRANSFORM, position: { x: 0, y: 1, z: 0 } },
      components: [newComponent('Collider'), { ...newComponent('RigidBody'), kind: 'kinematic' }],
    }
    const state: SceneState = { ...EMPTY_SCENE, nodes: [lift, rider] }
    const physics = notedPhysics()
    const world = worldFromScene('doc-1', state, ports(physics))

    for (let step = 0; step < 30; step++) world.step(1 / 60)

    const lifted = world.entities.get(lift.id)?.transform.position.y ?? 0
    const placed = physics.placed.at(-1)?.position.y ?? 0
    expect(lifted).toBeGreaterThan(1)
    // One metre above whatever the lift has reached — the whole of what composing a parent means.
    expect(placed).toBeCloseTo(lifted + 1, 6)
  })
})
