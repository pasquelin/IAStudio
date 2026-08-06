/**
 * The scene, as plain data. It holds no three.js object on purpose: an engine is rebuilt from
 * its serialized state, never from its DOM, and jsdom has no WebGL context to test against.
 */
export type Vector3 = { x: number; y: number; z: number }

export type Transform = {
  position: Vector3
  /** Euler angles, in radians. */
  rotation: Vector3
  scale: Vector3
}

export type SceneObjectKind = 'box' | 'sphere' | 'plane'

export type SceneObject = {
  id: string
  kind: SceneObjectKind
  name: string
  transform: Transform
}

export type SceneState = {
  objects: SceneObject[]
  selectedId: string | null
}

export const IDENTITY_TRANSFORM: Transform = {
  position: { x: 0, y: 0, z: 0 },
  rotation: { x: 0, y: 0, z: 0 },
  scale: { x: 1, y: 1, z: 1 },
}

export const EMPTY_SCENE: SceneState = { objects: [], selectedId: null }

export function objectById(state: SceneState, id: string): SceneObject | null {
  return state.objects.find(object => object.id === id) ?? null
}

export function serializeScene(state: SceneState): string {
  return JSON.stringify(state)
}

/** Unreadable input yields an empty scene: a blank viewport beats an uncaught throw. */
export function deserializeScene(raw: string): SceneState {
  try {
    const parsed: unknown = JSON.parse(raw)
    if (!parsed || typeof parsed !== 'object' || !('objects' in parsed)) return EMPTY_SCENE
    // The two guards above established the shape; `JSON.parse` can only hand back `unknown`.
    const { objects, selectedId } = parsed as Partial<SceneState>
    if (!Array.isArray(objects)) return EMPTY_SCENE
    return { objects, selectedId: typeof selectedId === 'string' ? selectedId : null }
  } catch {
    return EMPTY_SCENE
  }
}
