import {
  Color,
  Mesh,
  MeshStandardMaterial,
  Object3D,
  RepeatWrapping,
  SRGBColorSpace,
  Scene,
  type BufferGeometry,
  type Texture,
} from 'three'
import type { CsgGraph } from '@shared/domain/csg'
import type { MaterialDescriptor, SceneWorld } from '@shared/domain/scene'
import type { AssetPort } from '@game/ports/assetPort'
import { uncutGeometry } from '@/engines/csg/uncutGeometry'
import { createGeometryCache } from '@/engines/scene/geometryCache'
import { createGroundPlane } from '@/engines/scene/groundPlane'
import { applyFog } from '@/engines/scene/worldBinding'
import { loadTexture } from '@/engines/scene/textureCache'
import { applyMaterial, lightFor } from '@/engines/scene/threeSync'
import { applyTransform } from '@/engines/scene/pivot'
import type { SceneNode, SceneState } from '@/engines/scene/sceneState'
import { createCellGroups } from '@/engines/scene/cellInstancing'
import { groupingExclusions } from '@/engines/scene/grouping'
import { drivenNodes } from '@/engines/scene/animationEval'

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

/** How a carved solid's shape is worked out — see `carver`. */
type Carve = (graph: CsgGraph) => BufferGeometry

export async function buildGameScene(state: SceneState, assets: AssetPort): Promise<GameScene> {
  const carve = state.nodes.some(node => node.type === 'carved') ? await carver() : uncutGeometry
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
    const object = objectOf(node, geometries.acquire, dress, carve)
    if (!object) continue

    object.name = node.name
    object.visible = node.visible
    applyTransform(object, node.transform)
    byEntity.set(node.id, object)
  }

  // Parents second: a child may be declared before the group it hangs from.
  for (const node of state.nodes) {
    const object = byEntity.get(node.id)
    if (!object) continue

    const parent = node.parentId === null ? null : byEntity.get(node.parentId)
    ;(parent ?? scene).add(object)
  }

  scene.updateMatrixWorld()
  const instances = createCellGroups(scene)
  instances.rebuild(
    state.nodes,
    id => byEntity.get(id),
    groupingExclusions(state.nodes, drivenNodes(state.animation), 'instance'),
  )

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
      instances.dispose()
      ground.dispose()
      for (const held of textures.values()) void disposeWhenLoaded(held)
      scene.traverse(one => {
        if (!(one instanceof Mesh)) return
        // 🛑 RELEASED, never disposed: the same buffers are drawn by every node of that shape.
        // A carved solid is cut for itself and no cache lends it, so it is freed here or never.
        if (geometries.owns(one.geometry)) geometries.release(one.geometry)
        else one.geometry.dispose()
        if (one.material instanceof MeshStandardMaterial) one.material.dispose()
      })
    },
  }
}

/** A texture still in flight when the scene went: awaited, then dropped. Never rejects. */
async function disposeWhenLoaded(held: Promise<Texture>): Promise<void> {
  try {
    ;(await held).dispose()
  } catch {
    // Never loaded, so there is nothing to release — and its failure was already reported.
  }
}

function objectOf(
  node: SceneNode,
  acquire: ReturnType<typeof createGeometryCache>['acquire'],
  dress: (material: MeshStandardMaterial, assetId: string) => void,
  carve: Carve,
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
  if (node.type === 'carved') {
    const mesh = new Mesh(carve(node.carved), materialOf(node.material, dress))
    mesh.castShadow = node.castShadow
    mesh.receiveShadow = node.receiveShadow
    return mesh
  }
  if (node.type === 'light') return lightFor(node.light)
  // A group carries children and nothing else. A camera and a path ARE an editor's business.
  //
  // 🛑 `model` is a technical HOLE — its shape comes from a file no loader here lands. `sprite`
  // and `text` are a hole of SCOPE: the studio builds both synchronously, and this module already
  // has the arrival motif they need. Nothing invisible is walked into either way, `colliderFromNode`
  // feeling none of the three.
  return node.type === 'group' ? new Object3D() : null
}

/**
 * How a solid is cut, loaded ONLY for a scene that carves: the evaluator weighs 174,6 kB of the
 * exported bundle (43,6 gzip), measured, and a game with no carved solid must not pay it.
 *
 * 🛑 It cuts on the game's own thread — 20 solids of four steps froze 300 ms, measured — and a
 * scene swap goes through here too. A worker is what this wants; ADR-25's uncut brush is what it
 * falls back on, here as in the studio.
 */
async function carver(): Promise<Carve> {
  try {
    const { geometryOfGraph } = await import('@/engines/csg/csgEvaluate')
    return graph => {
      try {
        return geometryOfGraph(graph)
      } catch {
        // 🛑 SILENT, and it is a declared hole: an exported page has no journal this module can
        // reach, so a cut that throws shows a doorway walled up with nothing said.
        return uncutGeometry(graph)
      }
    }
  } catch {
    // The chunk an export failed to ship. Same hole, one scale up: every solid comes out uncut.
    return uncutGeometry
  }
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
