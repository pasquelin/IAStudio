import { Texture, type ColorSpace } from 'three'
import {
  DEFAULT_CAMERA,
  DEFAULT_PATH,
  type CameraDescriptor,
  type LightDescriptor,
  type PathDescriptor,
  type TextDescriptor,
} from '@shared/domain/scene'
import type { Bounds } from './rigFit'
import type { RigState } from './rigState'
import type { TextureCache } from './textureCache'
import {
  DEFAULT_MATERIAL,
  DEFAULT_SPRITE,
  DEFAULT_TEXT,
  shadowDefaults,
  IDENTITY_TRANSFORM,
  type CameraNode,
  type LightNode,
  type MeshNode,
  type ModelNode,
  type PathNode,
  type SpriteNode,
  type TextNode,
} from './sceneState'

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

export function cameraNodeFixture(id: string, camera: Partial<CameraDescriptor> = {}): CameraNode {
  return {
    id,
    parentId: null,
    name: id,
    visible: true,
    transform: IDENTITY_TRANSFORM,
    ...shadowDefaults({ type: 'camera' }),
    type: 'camera',
    camera: { ...DEFAULT_CAMERA, ...camera },
  }
}

export function pathNodeFixture(id: string, path: Partial<PathDescriptor> = {}): PathNode {
  return {
    id,
    parentId: null,
    name: id,
    visible: true,
    transform: IDENTITY_TRANSFORM,
    ...shadowDefaults({ type: 'path' }),
    type: 'path',
    path: { ...DEFAULT_PATH, ...path },
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
 * What the engine would report for a model carrying these bones, in one chain.
 *
 * For the suites that only care that a rig HAS bones — a bone picker, a track on one — and that
 * would otherwise each spell a whole `RigState` of their own.
 */
/** A standing figure of ordinary proportions, for a suite that is not testing the shape. */
export const STANDING_BOUNDS: Bounds = {
  min: { x: -0.3, y: 0, z: -0.2 },
  max: { x: 0.3, y: 1.8, z: 0.2 },
}

export function rigStateFixture(names: readonly string[]): RigState {
  const rigged = names.length > 0
  const bones = names.map((name, index) => ({ name, parent: names[index - 1] ?? null }))

  return {
    status: rigged ? 'skinnedMesh' : 'staticMesh',
    bones,
    boneNames: [...names],
    boneCount: names.length,
    // Nothing once there are bones, which is what the engine answers.
    bounds: rigged ? null : STANDING_BOUNDS,
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
  /** What the catalogue would say each asset was last written at — set by the test that cares. */
  const versions = new Map<string, string>()

  const cache: TextureCache = {
    acquire: (assetId, colorSpace) => {
      acquired.push(assetId)
      spaces.set(assetId, colorSpace)
      return new Promise(resolve => pending.set(assetId, resolve))
    },
    release: assetId => {
      released.push(assetId)
    },
    versionOf: assetId => versions.get(assetId),
    dispose: () => {},
  }

  return {
    cache,
    acquired,
    released,
    spaces,
    versions,
    settle: async (assetId: string, texture: Texture | null = new Texture()) => {
      pending.get(assetId)?.(texture)
      await Promise.resolve()
      return texture
    },
  }
}
