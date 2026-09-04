import {
  Color,
  Mesh,
  MeshStandardMaterial,
  Object3D,
  RepeatWrapping,
  SRGBColorSpace,
  Scene,
  type Texture,
  type BufferGeometry,
  type InstancedMesh,
} from 'three'
import type { CsgGraph } from '@shared/domain/csg'
import type { MaterialDescriptor, SceneWorld } from '@shared/domain/scene'
import type { HeightmapSamples } from '@shared/domain/heightmap'
import type { Transform } from '@shared/domain/transform'
import type { AssetPort } from '@game/ports/assetPort'
import type {
  CompiledModelMesh,
  CompiledNodeGeometry,
  CompiledSceneOptimization,
} from '@shared/domain/gameExport'
import { uncutGeometry } from '@/engines/csg/uncutGeometry'
import type { createGeometryCache } from '@/engines/scene/geometryCache'
import { createGroundPlane } from '@/engines/scene/groundPlane'
import { applyFog } from '@/engines/scene/worldBinding'
import { loadTexture } from '@/engines/scene/textureCache'
import { applyMaterial, lightFor } from '@/engines/scene/threeSync'
import { applyTransform } from '@/engines/scene/pivot'
import type { SceneNode, SceneState } from '@/engines/scene/sceneState'
import { createOptimizedGroups } from '@/engines/scene/optimizedGrouping'
import { runtimeArtifactsOf, runtimeOptimizationOf } from '@/engines/scene/runtimeWorldCompiler'
import { behavioralGroupingExclusions } from '@/engines/scene/grouping'
import { drivenNodes } from '@/engines/scene/animationEval'
import { disposeTree, instanceOf, type ModelSource } from '@/engines/scene/modelCache'
import { geometryOfCompiledMesh } from '@/engines/scene/compiledGeometry'
import type { SceneAnimations } from '@/engines/scene/animation'
import { createSceneResources, type SceneResources } from './gameSceneResources'
import { drapeWorld, type WorldDrape } from './gameSceneWorld'
import { clipKeyOf } from '@shared/domain/scene'
import type { ModelRef } from '@shared/domain/scene'
import type { Us } from '@shared/domain/time'
import {
  applyCompiledModel,
  applyGameTransform,
  instancedMeshesIn,
  rememberOwnLods,
  renderedGeometry,
} from './gameSceneOptimization'

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
  place: (entityId: string, transform: Transform) => void
  /** Settles what a whole frame of `place` left stale — the instanced bounds, once, not per call. */
  flush: () => void
  seek: (time: Us) => void
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

export async function buildGameScene(
  state: SceneState,
  assets: AssetPort,
  optimization?: CompiledSceneOptimization,
  modelAssets?: Readonly<Record<string, readonly CompiledModelMesh[]>>,
  loadModel?: ModelSource,
  heightmaps?: ReadonlyMap<string, HeightmapSamples>,
): Promise<GameScene> {
  const compiled = new Map(optimization?.nodes.map(node => [node.nodeId, node]) ?? [])
  const needsCarver = state.nodes.some(
    node =>
      node.type === 'carved' && !compiled.get(node.id)?.mesh && !compiled.get(node.id)?.lodMeshes,
  )
  const carve = needsCarver ? await carver() : uncutGeometry
  const scene = new Scene()
  const byEntity = new Map<string, Object3D>()
  const placements = new Map<string, (transform: Transform) => void>()
  const resources = createSceneResources(state.animation)
  const dress = createDress(assets, resources.textures)

  await populateScene(
    state.nodes,
    scene,
    byEntity,
    placements,
    compiled,
    resources.geometries.acquire,
    dress,
    carve,
    createModelOf(assets, loadModel, resources),
    modelAssets,
    resources.staleInstances,
  )

  const drape = await drapeWorld(scene, state.world, assets, loadModel, heightmaps)
  return finalizeGameScene({
    state,
    optimization,
    scene,
    byEntity,
    placements,
    resources,
    drape,
  })
}

function createDress(assets: AssetPort, textures: Map<string, Promise<Texture>>) {
  return (material: MeshStandardMaterial, assetId: string): void => {
    const url = assets.urlOf({ kind: 'asset', id: assetId })
    if (url !== null) void wearTexture(material, assetId, url, textures)
  }
}

async function wearTexture(
  material: MeshStandardMaterial,
  assetId: string,
  url: string,
  textures: Map<string, Promise<Texture>>,
): Promise<void> {
  try {
    const held = textures.get(assetId) ?? loadTexture(url)
    textures.set(assetId, held)
    const texture = await held
    texture.colorSpace = SRGBColorSpace
    texture.wrapS = RepeatWrapping
    texture.wrapT = RepeatWrapping
    material.map = texture
    material.needsUpdate = true
  } catch {
    return
  }
}

type FinalizeContext = {
  state: SceneState
  optimization: CompiledSceneOptimization | undefined
  scene: Scene
  byEntity: Map<string, Object3D>
  placements: Map<string, (transform: Transform) => void>
  resources: SceneResources
  drape: WorldDrape
}

function finalizeGameScene(context: FinalizeContext): GameScene {
  const { state, optimization, scene, byEntity, placements, resources, drape } = context
  const { staleInstances, animations } = resources
  scene.updateMatrixWorld()
  const instances = createOptimizedGroups(scene)
  const excluded = new Set(behavioralGroupingExclusions(state.nodes, drivenNodes(state.animation)))
  for (const node of optimization?.nodes ?? []) {
    if (node.lodGeometries || node.lodCarved) excluded.add(node.nodeId)
  }
  instances.rebuild(
    state.nodes,
    id => byEntity.get(id),
    excluded,
    runtimeOptimizationOf(state)?.artifacts ?? runtimeArtifactsOf(state.nodes, state.animation),
  )

  // 🛑 What a game shows of the world, and what it does NOT: the image-based environment is not
  // shipped, so `environment` falls back to a plain sky rather than to black. Written rather than
  // hidden — an exported scene lit only by its environment is a scene lit by nothing.
  scene.background = new Color(
    state.world.background.kind === 'color' ? state.world.background.color : NO_ENVIRONMENT,
  )
  applyFog(scene, state.world.fog)

  const ground = drape.hideGround ? null : createGroundPlane()
  if (ground) {
    ground.apply(state.world.ground, MESH_COLOUR)
    scene.add(ground.object)
  }

  return {
    scene,
    world: state.world,
    byEntity,
    place: (entityId, transform) => placements.get(entityId)?.(transform),
    // 🛑 Once a frame, never per instance: `computeBoundingSphere` walks every slot of the mesh,
    // so recomputing it inside the placement made a 1 000-instance node quadratic per frame.
    flush: () => {
      for (const mesh of staleInstances) {
        mesh.instanceMatrix.needsUpdate = true
        mesh.computeBoundingSphere()
      }
      staleInstances.clear()
    },
    seek: time => animations.seek(time),
    dispose: () => {
      animations.clear()
      instances.dispose()
      drape.dispose()
      ground?.dispose()
      for (const held of resources.textures.values()) void disposeWhenLoaded(held)
      for (const held of resources.models.values()) void disposeModelWhenLoaded(held)
      for (const geometry of resources.ownedModelGeometries) geometry.dispose()
      scene.traverse(one => {
        if (!(one instanceof Mesh)) return
        if (resources.modelMeshes.has(one)) return
        // 🛑 RELEASED, never disposed: the same buffers are drawn by every node of that shape.
        // A carved solid is cut for itself and no cache lends it, so it is freed here or never.
        if (resources.geometries.owns(one.geometry)) resources.geometries.release(one.geometry)
        else one.geometry.dispose()
        if (one.material instanceof MeshStandardMaterial) one.material.dispose()
      })
    },
  }
}

function createModelOf(
  assets: AssetPort,
  loadModel: ModelSource | undefined,
  resources: SceneResources,
) {
  return async (
    nodeId: string,
    model: ModelRef,
    modelPlan: readonly CompiledModelMesh[] | undefined,
  ): Promise<Object3D | null> => {
    const url = assets.urlOf({ kind: 'asset', id: model.assetId })
    if (!url || !loadModel) return null
    try {
      const held = resources.models.get(model.assetId) ?? loadModel(url)
      resources.models.set(model.assetId, held)
      const source = await held
      const object = instanceOf(source)
      object.traverse(child => {
        if (child instanceof Mesh) resources.modelMeshes.add(child)
      })
      const optimized = applyCompiledModel(
        object,
        modelPlan,
        resources.ownedModelGeometries,
        resources.modelMeshes,
      )
      resources.animations.add(nodeId, optimized, source.animations)
      await loadModelAnimations(nodeId, model, assets, loadModel, resources.animations)
      resources.animations.apply(nodeId, model.lanes ?? [])
      return optimized
    } catch {
      return null
    }
  }
}

async function populateScene(
  nodes: readonly SceneNode[],
  scene: Scene,
  byEntity: Map<string, Object3D>,
  placements: Map<string, (transform: Transform) => void>,
  compiled: ReadonlyMap<string, CompiledNodeGeometry>,
  acquire: ReturnType<typeof createGeometryCache>['acquire'],
  dress: (material: MeshStandardMaterial, assetId: string) => void,
  carve: Carve,
  modelOf: (
    nodeId: string,
    model: ModelRef,
    modelPlan: readonly CompiledModelMesh[] | undefined,
  ) => Promise<Object3D | null>,
  modelAssets: Readonly<Record<string, readonly CompiledModelMesh[]>> | undefined,
  staleInstances: Set<InstancedMesh>,
): Promise<void> {
  const objects = await Promise.all(
    nodes.map(async node =>
      objectOf(node, compiled.get(node.id), acquire, dress, carve, modelOf, modelAssets),
    ),
  )
  for (const [index, node] of nodes.entries()) {
    const object = objects[index]
    if (!object) continue
    object.name = node.name
    object.visible = node.visible
    // Its OWN levels, before parenting hangs other nodes under it: a child rescales its own.
    rememberOwnLods(object)
    applyGameTransform(object, node.transform)
    byEntity.set(node.id, object)
    placements.set(node.id, transform => applyGameTransform(object, transform))
    registerBakedPlacements(node, object, byEntity, placements, staleInstances)
  }
  for (const node of nodes) {
    const object = byEntity.get(node.id)
    if (!object) continue
    const parent = node.parentId === null ? null : byEntity.get(node.parentId)
    ;(parent ?? scene).add(object)
  }
}

function registerBakedPlacements(
  node: SceneNode,
  object: Object3D,
  byEntity: Map<string, Object3D>,
  placements: Map<string, (transform: Transform) => void>,
  staleInstances: Set<InstancedMesh>,
): void {
  if (node.type !== 'mesh' || !node.instances) return
  const renderedInstances = instancedMeshesIn(object)
  const placement = new Object3D()
  for (const [slot, instance] of node.instances.entries()) {
    byEntity.set(instance.sourceId, object)
    placements.set(instance.sourceId, transform => {
      applyTransform(placement, transform)
      placement.updateMatrix()
      for (const mesh of renderedInstances) {
        mesh.setMatrixAt(slot, placement.matrix)
        staleInstances.add(mesh)
      }
    })
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

async function disposeModelWhenLoaded(held: Promise<Object3D>): Promise<void> {
  try {
    disposeTree(await held)
  } catch {
    // A model that never loaded owns no render resource to release.
  }
}

async function objectOf(
  node: SceneNode,
  compiled: CompiledNodeGeometry | undefined,
  acquire: ReturnType<typeof createGeometryCache>['acquire'],
  dress: (material: MeshStandardMaterial, assetId: string) => void,
  carve: Carve,
  modelOf: (
    nodeId: string,
    model: ModelRef,
    modelPlan: readonly CompiledModelMesh[] | undefined,
  ) => Promise<Object3D | null>,
  modelAssets: Readonly<Record<string, readonly CompiledModelMesh[]>> | undefined,
): Promise<Object3D | null> {
  if (node.type === 'mesh') return meshObject(node, compiled, acquire, dress)
  if (node.type === 'carved') return carvedObject(node, compiled, carve, dress)
  if (node.type === 'light') return lightFor(node.light)
  if (node.type === 'model') {
    const modelPlan = compiled?.modelAssetId ? modelAssets?.[compiled.modelAssetId] : undefined
    return await modelOf(node.id, node.model, modelPlan)
  }
  // A group carries children. Cameras, paths, sprites and text belong to the editor renderer.
  return node.type === 'group' ? new Object3D() : null
}

function meshObject(
  node: Extract<SceneNode, { type: 'mesh' }>,
  compiled: CompiledNodeGeometry | undefined,
  acquire: ReturnType<typeof createGeometryCache>['acquire'],
  dress: (material: MeshStandardMaterial, assetId: string) => void,
): Object3D {
  const descriptors = compiled?.lodGeometries ?? [compiled?.geometry ?? node.geometry]
  const object = renderedGeometry(
    descriptors.map(descriptor => acquire(descriptor, node.material.tilesPerMetre)),
    materialOf(node.material, dress),
    node.instances,
  )
  applyShadows(object, node.castShadow, node.receiveShadow)
  return object
}

function carvedObject(
  node: Extract<SceneNode, { type: 'carved' }>,
  compiled: CompiledNodeGeometry | undefined,
  carve: Carve,
  dress: (material: MeshStandardMaterial, assetId: string) => void,
): Object3D {
  const geometries =
    compiled?.lodMeshes?.map(geometryOfCompiledMesh) ??
    (compiled?.mesh ? [geometryOfCompiledMesh(compiled.mesh)] : undefined)
  const graphs = geometries ? [] : (compiled?.lodCarved ?? [compiled?.carved ?? node.carved])
  const object = renderedGeometry(
    geometries ?? graphs.map(graph => carve(graph)),
    materialOf(node.material, dress),
  )
  applyShadows(object, node.castShadow, node.receiveShadow)
  return object
}

function applyShadows(object: Object3D, cast: boolean, receive: boolean): void {
  object.traverse(child => {
    if (!(child instanceof Mesh)) return
    child.castShadow = cast
    child.receiveShadow = receive
  })
}

async function loadModelAnimations(
  nodeId: string,
  model: ModelRef,
  assets: AssetPort,
  loadModel: ModelSource,
  animations: SceneAnimations,
): Promise<void> {
  for (const lane of model.lanes ?? []) {
    for (const clip of lane.clips) {
      if (clip.source.kind !== 'asset') continue
      const url = assets.urlOf({ kind: 'asset', id: clip.source.assetId })
      if (!url) continue
      try {
        const source = await loadModel(url)
        const animation = source.animations[0]
        if (animation) animations.addClip(nodeId, clipKeyOf(clip.source), animation)
        disposeTree(source)
      } catch {
        continue
      }
    }
  }
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
