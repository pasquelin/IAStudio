import { Texture, type ColorSpace } from 'three'
import type { LightDescriptor, TextDescriptor } from '@shared/domain/scene'
import type { TextureCache } from './texture-cache'
import {
  DEFAULT_MATERIAL,
  DEFAULT_SPRITE,
  DEFAULT_TEXT,
  shadowDefaults,
  IDENTITY_TRANSFORM,
  type LightNode,
  type MeshNode,
  type ModelNode,
  type SpriteNode,
  type TextNode,
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

export function textNodeFixture(id: string, text: Partial<TextDescriptor> = {}): TextNode {
  return {
    id,
    parentId: null,
    name: id,
    visible: true,
    transform: IDENTITY_TRANSFORM,
    ...shadowDefaults({ type: 'text' }),
    type: 'text',
    text: { ...DEFAULT_TEXT, ...text },
    material: DEFAULT_MATERIAL,
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

/**
 * A texture cache whose loads the test settles by hand, so arrival order is what is under test —
 * which is what every suite around a `TextureBinding` is really about.
 */
export function scriptedTextureCache() {
  const pending = new Map<string, (texture: Texture | null) => void>()
  const acquired: string[] = []
  const released: string[] = []
  const spaces = new Map<string, ColorSpace>()

  const cache: TextureCache = {
    acquire: (assetId, colorSpace) => {
      acquired.push(assetId)
      spaces.set(assetId, colorSpace)
      return new Promise(resolve => pending.set(assetId, resolve))
    },
    release: assetId => {
      released.push(assetId)
    },
    dispose: () => {},
  }

  return {
    cache,
    acquired,
    released,
    spaces,
    settle: async (assetId: string, texture: Texture | null = new Texture()) => {
      pending.get(assetId)?.(texture)
      await Promise.resolve()
      return texture
    },
  }
}
