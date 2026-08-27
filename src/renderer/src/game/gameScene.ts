import {
  Color,
  Mesh,
  MeshStandardMaterial,
  Object3D,
  RepeatWrapping,
  SRGBColorSpace,
  Scene,
  type Texture,
} from 'three'
import type { MaterialDescriptor, SceneWorld } from '@shared/domain/scene'
import type { AssetPort } from '@game/ports/assetPort'
import { createGeometryCache } from '@/engines/scene/geometryCache'
import { createGroundPlane } from '@/engines/scene/groundPlane'
import { applyFog } from '@/engines/scene/worldBinding'
import { loadTexture } from '@/engines/scene/textureCache'
import { applyMaterial, lightFor } from '@/engines/scene/threeSync'
import type { SceneNode, SceneState } from '@/engines/scene/sceneState'

/**
 * A scene as three.js draws it in a GAME — no gizmo, no helper, no selection, no grid.
 *
 * 🛑 Not `SceneRenderer`: that one is 4 500 lines of editor, and a game shipping it ships the
 * studio. What a game needs is the shapes, the lights and the sky.
 */
export type GameScene = {
  scene: Scene
  /** What the RENDERER has to settle rather than the scene graph — the tone mapping and exposure. */
  world: SceneWorld
  /** Where each entity's object is, so a step can place it without walking the tree. */
  byEntity: ReadonlyMap<string, Object3D>
  dispose: () => void
}

/**
 * A game reads no CSS token, so the studio's own mesh colour cannot be resolved: this is the
 * value `--sc-mesh` settles on in the shipped theme.
 */
const MESH_COLOUR = '#b0b4bd'

/** What stands behind a scene whose backdrop is an environment a game does not ship. */
const NO_ENVIRONMENT = '#9fb2c8'

export function buildGameScene(state: SceneState, assets: AssetPort): GameScene {
  const scene = new Scene()
  const byEntity = new Map<string, Object3D>()
  const geometries = createGeometryCache()
  // The PROMISE, not the texture: two nodes wearing one picture must decode it once.
  const textures = new Map<string, Promise<Texture>>()

  /**
   * 🛑 Through `loadTexture`, never three's own loader: a PNG decoded on the UI thread is a frame
   * nobody draws, and `textureCache.test.ts` refuses that loader by name — in a COMMENT too.
   */
  const dress = (material: MeshStandardMaterial, assetId: string): void => {
    const url = assets.urlOf({ kind: 'asset', id: assetId })
    if (url !== null) void wearing(material, assetId, url)
  }

  async function wearing(
    material: MeshStandardMaterial,
    assetId: string,
    url: string,
  ): Promise<void> {
    try {
      const held = textures.get(assetId) ?? loadTexture(url)
      textures.set(assetId, held)
      const texture = await held
      // 🛑 What `createTextureCache` stamps in the studio and a bare `loadTexture` does not: a
      // base map read as linear draws the game brighter, and clamped UVs smear one texel over a
      // floor that asked for four tiles.
      texture.colorSpace = SRGBColorSpace
      texture.wrapS = RepeatWrapping
      texture.wrapT = RepeatWrapping
      material.map = texture
      material.needsUpdate = true
    } catch {
      // A picture the project has lost. The shape is drawn plain rather than not at all.
    }
  }

  for (const node of state.nodes) {
    const object = objectOf(node, geometries.acquire, dress)
    if (!object) continue

    object.name = node.name
    object.visible = node.visible
    place(object, node)
    byEntity.set(node.id, object)
  }

  // Parents second: a child may be declared before the group it hangs from.
  for (const node of state.nodes) {
    const object = byEntity.get(node.id)
    if (!object) continue

    const parent = node.parentId === null ? null : byEntity.get(node.parentId)
    ;(parent ?? scene).add(object)
  }

  // 🛑 What a game shows of the world, and what it does NOT: the image-based environment is not
  // shipped, so `environment` falls back to a plain sky rather than to black. Written rather than
  // hidden — an exported scene lit only by its environment is a scene lit by nothing.
  scene.background = new Color(
    state.world.background.kind === 'color' ? state.world.background.color : NO_ENVIRONMENT,
  )
  applyFog(scene, state.world.fog)

  const ground = createGroundPlane()
  ground.apply(state.world.ground, MESH_COLOUR)
  scene.add(ground.object)

  return {
    scene,
    world: state.world,
    byEntity,
    dispose: () => {
      ground.dispose()
      for (const held of textures.values()) void held.then(texture => texture.dispose())
      scene.traverse(one => {
        if (!(one instanceof Mesh)) return
        // 🛑 RELEASED, never disposed: the same buffers are drawn by every node of that shape.
        geometries.release(one.geometry)
        if (one.material instanceof MeshStandardMaterial) one.material.dispose()
      })
    },
  }
}

function objectOf(
  node: SceneNode,
  acquire: ReturnType<typeof createGeometryCache>['acquire'],
  dress: (material: MeshStandardMaterial, assetId: string) => void,
): Object3D | null {
  if (node.type === 'mesh') {
    const mesh = new Mesh(
      acquire(node.geometry, node.material.tilesPerMetre),
      materialOf(node.material, dress),
    )
    mesh.castShadow = node.castShadow
    mesh.receiveShadow = node.receiveShadow
    return mesh
  }
  if (node.type === 'light') return lightFor(node.light)
  // A group carries children and nothing else; every other kind is an editor's business.
  return node.type === 'group' ? new Object3D() : null
}

const materialOf = (
  descriptor: MaterialDescriptor,
  dress: (material: MeshStandardMaterial, assetId: string) => void,
): MeshStandardMaterial => {
  const material = new MeshStandardMaterial()
  applyMaterial(material, descriptor, MESH_COLOUR)
  if (descriptor.map) dress(material, descriptor.map.assetId)
  return material
}

const place = (object: Object3D, node: SceneNode): void => {
  const { position, rotation, scale } = node.transform
  object.position.set(position.x, position.y, position.z)
  object.rotation.set(rotation.x, rotation.y, rotation.z)
  object.scale.set(scale.x, scale.y, scale.z)
}
