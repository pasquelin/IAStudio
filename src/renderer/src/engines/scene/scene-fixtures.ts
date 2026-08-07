import type { LightDescriptor } from '@shared/domain/scene'
import { DEFAULT_MATERIAL, IDENTITY_TRANSFORM, type LightNode, type MeshNode } from './scene-state'

/**
 * Scene nodes for tests. Declared once so a new required field on `SceneNodeBase` breaks in one
 * place rather than in every suite that builds a node by hand. Narrowed rather than `SceneNode`:
 * a test that dresses a mesh needs its material to exist.
 */
export function meshNode(id: string, parentId: string | null = null): MeshNode {
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

export function lightNodeFixture(
  id: string,
  light: LightDescriptor = { kind: 'ambient', color: '#222222', intensity: 1 },
): LightNode {
  return {
    id,
    parentId: null,
    name: id,
    visible: true,
    transform: IDENTITY_TRANSFORM,
    type: 'light',
    light,
  }
}
