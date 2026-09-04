// @vitest-environment jsdom
import { describe, expect, it, vi } from 'vitest'
import { createInertPhysics } from '@game/host/inertPhysics'
import { createInertScripts } from '@game/host/inertScripts'
import { EMPTY_TIMELINE } from '@shared/domain/animation'
import { newComponent } from '@shared/domain/componentRegistry'
import { DEFAULT_WORLD } from '@shared/domain/scene'
import { meshNode } from './scene-fixtures'
import type { SceneNode, SceneState } from './sceneState'
import {
  copiedInstanceIdsAreFresh,
  executeRuntimeFunctionalChecks,
} from './executedRuntimeValidation'

function executableScene(): SceneState {
  const group: SceneNode = {
    id: 'group',
    parentId: null,
    name: 'Group',
    type: 'group',
    visible: true,
    transform: meshNode('unused').transform,
    castShadow: false,
    receiveShadow: false,
  }
  const scripted = {
    ...meshNode('scripted'),
    parentId: group.id,
    components: [{ ...newComponent('Script'), script: 'script:Walk.ts' }],
    instances: [
      {
        sourceId: 'scripted-instance',
        name: 'Scripted instance',
        transform: meshNode('i').transform,
      },
    ],
  }
  const physical = {
    ...meshNode('physical'),
    parentId: group.id,
    components: [newComponent('Collider'), newComponent('RigidBody')],
  }
  return {
    nodes: [group, scripted, physical],
    selectedIds: [],
    world: DEFAULT_WORLD,
    animation: {
      ...EMPTY_TIMELINE,
      events: [{ id: 'event', at: 0, name: 'Started' }],
      transitions: [{ id: 'cut', at: 0, kind: 'cut', duration: 0, scene: 'Next' }],
    },
  }
}

describe('executed runtime validation', () => {
  it('runs gameplay systems and the editable duplication history', async () => {
    const checks = await executeRuntimeFunctionalChecks(executableScene())

    expect(checks.scripts).toMatchObject({
      events: ['Started'],
      entities: expect.arrayContaining([
        expect.objectContaining({
          id: 'scripted',
          transform: expect.objectContaining({
            position: { x: 1 / 6, y: 0, z: 0 },
          }),
        }),
      ]),
    })
    const scripts = checks.scripts
    if (typeof scripts !== 'object' || scripts === null) throw new Error('missing script result')
    expect(Reflect.get(scripts, 'hooks')).toHaveLength(10)
    expect(Reflect.get(scripts, 'frames')).toEqual([0, 1, 2, 3, 4, 5, 6, 7, 8, 9])
    expect(checks.physics).toMatchObject({
      bodies: [{ body: 'physical', kind: 'dynamic' }],
    })
    const physics = checks.physics
    if (typeof physics !== 'object' || physics === null) throw new Error('missing physics result')
    expect(Reflect.get(physics, 'steps')).toHaveLength(10)
    expect(checks.timeline).toEqual({
      veils: Array.from({ length: 10 }, () => 0),
      scenes: [{ scene: 'Next', fade: 0 }],
    })
    expect(checks.duplication).toMatchObject({
      equivalent: true,
      freshIds: true,
      freshInstanceIds: true,
    })
    const duplication = checks.duplication
    if (typeof duplication !== 'object' || duplication === null)
      throw new Error('missing duplication result')
    expect(Reflect.get(duplication, 'copies')).toEqual(Reflect.get(duplication, 'originals'))
    const undoRedo = checks.undoRedo
    if (typeof undoRedo !== 'object' || undoRedo === null) throw new Error('missing history result')
    expect(Reflect.get(Reflect.get(undoRedo, 'applied'), 'nodes')).toHaveLength(6)
    expect(Reflect.get(Reflect.get(undoRedo, 'undone'), 'nodes')).toHaveLength(3)
    expect(Reflect.get(Reflect.get(undoRedo, 'applied'), 'selected')).toEqual([3, 4, 5])
    expect(Reflect.get(Reflect.get(undoRedo, 'undone'), 'selected')).toEqual([])
    expect(undoRedo).toMatchObject({ restored: true, replayed: true })
    expect(Reflect.get(undoRedo, 'applied')).toEqual(Reflect.get(undoRedo, 'redone'))
  })

  it('records only successful engines and releases every acquired port', async () => {
    const failed = await executeRuntimeFunctionalChecks(executableScene(), {
      createScripts: async () => ({
        ...createInertScripts(),
        declares: hook => hook === 'onUpdate',
        run: () => {
          throw new Error('script failed')
        },
      }),
      createPhysics: async () => ({
        ...createInertPhysics(),
        add: () => {
          throw new Error('physics refused setup')
        },
        step: () => {
          throw new Error('physics failed')
        },
      }),
    })
    expect(failed.scripts).toMatchObject({ hooks: [], frames: [] })
    expect(failed.physics).toMatchObject({ bodies: [], steps: [] })

    const scriptDispose = vi.fn()
    const physicsDispose = vi.fn(() => {
      throw new Error('physics cleanup failed')
    })
    const scripts = {
      ...createInertScripts(),
      dispose: scriptDispose,
    }
    const physics = {
      ...createInertPhysics(),
      dispose: physicsDispose,
    }

    await expect(
      executeRuntimeFunctionalChecks(executableScene(), {
        createScripts: async () => scripts,
        createPhysics: async () => physics,
      }),
    ).rejects.toThrow('physics cleanup failed')
    expect(physicsDispose).toHaveBeenCalledOnce()
    expect(scriptDispose).toHaveBeenCalledOnce()

    const releasedAfterAcquisitionFailure = vi.fn()
    await expect(
      executeRuntimeFunctionalChecks(executableScene(), {
        createScripts: async () => ({
          ...createInertScripts(),
          dispose: releasedAfterAcquisitionFailure,
        }),
        createPhysics: async () => {
          throw new Error('physics did not load')
        },
      }),
    ).rejects.toThrow('physics did not load')
    expect(releasedAfterAcquisitionFailure).toHaveBeenCalledOnce()
  })

  it('rejects an instance identity colliding outside the duplicated subtree', () => {
    const source = executableScene().nodes
    const outside = {
      ...meshNode('outside'),
      instances: [
        { sourceId: 'outside-instance', name: 'Outside', transform: meshNode('o').transform },
      ],
    }
    const copy = {
      ...meshNode('copy'),
      instances: [
        { sourceId: 'outside-instance', name: 'Copy', transform: meshNode('c').transform },
      ],
    }

    expect(copiedInstanceIdsAreFresh([...source, outside], [copy])).toBe(false)
  })
})
