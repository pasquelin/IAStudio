import { describe, expect, it } from 'vitest'
import {
  deserializeScene,
  EMPTY_SCENE,
  IDENTITY_TRANSFORM,
  objectById,
  serializeScene,
  type SceneState,
} from './scene-state'

const populated: SceneState = {
  objects: [
    { id: 'a', kind: 'box', name: 'Box', transform: IDENTITY_TRANSFORM },
    {
      id: 'b',
      kind: 'sphere',
      name: 'Sphere',
      transform: { ...IDENTITY_TRANSFORM, position: { x: 1, y: 2, z: 3 } },
    },
  ],
  selectedId: 'b',
}

describe('scene state', () => {
  it('starts empty with nothing selected', () => {
    expect(EMPTY_SCENE.objects).toHaveLength(0)
    expect(EMPTY_SCENE.selectedId).toBeNull()
  })

  it('finds an object by id', () => {
    expect(objectById(populated, 'b')?.name).toBe('Sphere')
  })

  it('returns null for an unknown id', () => {
    expect(objectById(populated, 'nope')).toBeNull()
  })

  it('survives a serialize/deserialize round trip unchanged', () => {
    expect(deserializeScene(serializeScene(populated))).toEqual(populated)
  })

  it('falls back to an empty scene rather than throwing on unreadable input', () => {
    // The state comes from a store that may outlive a format change; a blank viewport beats
    // an unhandled throw with no error boundary above it.
    expect(deserializeScene('{ not json')).toEqual(EMPTY_SCENE)
  })
})
