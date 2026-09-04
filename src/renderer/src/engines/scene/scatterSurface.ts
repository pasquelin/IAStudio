import { Group, type Object3D, type Scene } from 'three'
import { getHeightAt, type ReliefHeightLayer } from '@shared/domain/relief'
import { clamp } from '@shared/numeric'
import { enabledScatters, enabledTerrains, type SceneWorld } from '@shared/domain/scene'
import type { HeightmapSamples } from '@shared/domain/heightmap'
import {
  scatterPosesOf,
  type ScatterGround,
  type ScatterPose,
} from '@shared/domain/scatterGenerate'
import { holdScatterCells, scatterBatchesOf, scatterDrawnOf } from './scatterRender'
import { buildPartition, type WorldPartition } from './worldPartition'
import type { ModelCache } from './modelCache'
import { clipsOf } from './animation'
import { meshesOf } from './instanceableModel'
import { rigStateOf } from './rigState'

export type ScatterSurface = {
  object: Object3D
  partition: WorldPartition
  sync: (world: SceneWorld, heightmaps?: ReadonlyMap<string, HeightmapSamples>) => Promise<void>
  dispose: () => void
}

type ScatterSurfaceOptions = {
  models: ModelCache
  onUnsupported: (assetId: string, status: string) => void
  onReady?: () => void
}

type ScatterAssets = {
  revision: number
  sources: Map<string, Object3D>
  held: Set<string>
  loading: Map<string, Promise<Object3D | null>>
}

export function createScatterSurface(scene: Scene, options: ScatterSurfaceOptions): ScatterSurface {
  const group = new Group()
  group.name = 'scene-scatter'
  scene.add(group)
  let partition = buildPartition()
  const assets: ScatterAssets = {
    revision: 0,
    sources: new Map(),
    held: new Set(),
    loading: new Map(),
  }
  return {
    object: group,
    get partition() {
      return partition
    },
    sync: async (world, heightmaps) => {
      const syncRevision = await reconcileSources(world, assets, options)
      if (syncRevision !== assets.revision) return
      clearGroup(group)
      partition = buildPartition()
      const ground = scatterGroundOf(world, heightmaps)
      const poses = posesOf(world, ground)
      const batches = scatterBatchesOf(poses, partition.cellAt)
      holdScatterCells(batches, partition)
      for (const batch of batches) {
        const source = assets.sources.get(batch.assetId)
        if (!source) continue
        for (const mesh of meshesOf(source)) group.add(scatterDrawnOf(batch, mesh))
      }
      options.onReady?.()
    },
    dispose: () => {
      assets.revision += 1
      clearGroup(group)
      for (const assetId of assets.held) options.models.release(assetId)
      assets.held.clear()
      assets.sources.clear()
      assets.loading.clear()
    },
  }
}

async function reconcileSources(
  world: SceneWorld,
  assets: ScatterAssets,
  options: ScatterSurfaceOptions,
): Promise<number> {
  const revision = ++assets.revision
  const wanted = new Set(
    enabledScatters(world.layers).flatMap(layer => layer.assets.map(asset => asset.assetId)),
  )
  releaseRemoved(wanted, assets, options.models)
  for (const assetId of wanted) {
    if (assets.sources.has(assetId)) continue
    const source = await sourceOf(assetId, assets, options.models)
    if (source && assets.held.has(assetId) && acceptsScatterSource(assetId, source, options)) {
      source.updateWorldMatrix(false, true)
      assets.sources.set(assetId, source)
    }
  }
  return revision
}

function sourceOf(
  assetId: string,
  assets: ScatterAssets,
  models: ModelCache,
): Promise<Object3D | null> {
  const loading = assets.loading.get(assetId)
  if (loading) return loading
  assets.held.add(assetId)
  const acquired = models.acquire(assetId)
  assets.loading.set(assetId, acquired)
  return acquired
}

function releaseRemoved(
  wanted: ReadonlySet<string>,
  assets: ScatterAssets,
  models: ModelCache,
): void {
  for (const assetId of [...assets.held]) {
    if (wanted.has(assetId)) continue
    assets.held.delete(assetId)
    assets.sources.delete(assetId)
    assets.loading.delete(assetId)
    models.release(assetId)
  }
}

function acceptsScatterSource(
  assetId: string,
  source: Object3D,
  options: ScatterSurfaceOptions,
): boolean {
  const clips = clipsOf(source)
  const status = rigStateOf(source, clips).status
  if (status === 'staticMesh' && clips.length === 0) return true
  options.onUnsupported(assetId, clips.length > 0 ? 'animatedModel' : status)
  return false
}

function posesOf(world: SceneWorld, ground: ScatterGround): ScatterPose[] {
  const poses: ScatterPose[] = []
  for (const layer of enabledScatters(world.layers)) {
    poses.push(
      ...scatterPosesOf(
        layer,
        {
          minX: layer.origin.x,
          minZ: layer.origin.z,
          maxX: layer.origin.x + layer.size.x,
          maxZ: layer.origin.z + layer.size.z,
        },
        ground,
      ),
    )
  }
  return poses
}

function scatterGroundOf(
  world: SceneWorld,
  heightmaps: ReadonlyMap<string, HeightmapSamples> | undefined,
): ScatterGround {
  const terrains: ReliefHeightLayer[] = enabledTerrains(world.layers).flatMap(layer => {
    const samples = heightmaps?.get(layer.heightmap.assetId)
    return samples ? [{ ...layer, samples }] : []
  })
  return {
    heightAt: (x, z) => getHeightAt(terrains, x, z),
    slopeAt: (x, z) => slopeAt(terrains, x, z),
  }
}

function slopeAt(
  terrains: readonly ReliefHeightLayer[],
  x: number,
  z: number,
): { degrees: number; nx: number; ny: number; nz: number } {
  const height = getHeightAt(terrains, x, z) ?? 0
  const east = getHeightAt(terrains, x + 0.5, z) ?? height
  const north = getHeightAt(terrains, x, z + 0.5) ?? height
  const nx = height - east
  const nz = height - north
  const length = Math.hypot(nx, 1, nz) || 1
  return {
    degrees: Math.acos(clamp(1 / length, -1, 1)) * (180 / Math.PI),
    nx: nx / length,
    ny: 1 / length,
    nz: nz / length,
  }
}

function clearGroup(group: Group): void {
  for (const child of [...group.children]) group.remove(child)
}
