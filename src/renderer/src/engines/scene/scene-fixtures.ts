import type { LightDescriptor } from '@shared/domain/scene'
import {
  DEFAULT_MATERIAL,
  DEFAULT_SPRITE,
  shadowDefaults,
  IDENTITY_TRANSFORM,
  type LightNode,
  type MeshNode,
  type ModelNode,
  type SpriteNode,
} from './scene-state'

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
    ...shadowDefaults({ type: 'mesh' }),
    type: 'mesh',
    geometry: { kind: 'box', width: 1, height: 1, depth: 1 },
    material: DEFAULT_MATERIAL,
  }
}

/** The one light kind that builds a helper and a target beside itself. */
export function directionalLight(id: string): LightNode {
  return lightNodeFixture(id, {
    kind: 'directional',
    color: '#ffffff',
    intensity: 1,
    target: { x: 0, y: 0, z: 0 },
  })
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
    ...shadowDefaults({ type: 'light', light }),
    type: 'light',
    light,
  }
}

export function spriteNodeFixture(id: string, map: string | null = null): SpriteNode {
  return {
    id,
    parentId: null,
    name: id,
    visible: true,
    transform: IDENTITY_TRANSFORM,
    ...shadowDefaults({ type: 'sprite' }),
    type: 'sprite',
    sprite: { ...DEFAULT_SPRITE, map: map === null ? null : { assetId: map } },
  }
}

export function modelNodeFixture(id: string, assetId = 'asset-1'): ModelNode {
  return {
    id,
    parentId: null,
    name: id,
    visible: true,
    transform: IDENTITY_TRANSFORM,
    ...shadowDefaults({ type: 'model' }),
    type: 'model',
    model: { assetId },
  }
}
