import { BoxGeometry, Group, MeshStandardMaterial, type Object3D, type Scene } from 'three'
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

export type ScatterSurface = {
  object: Object3D
  partition: WorldPartition
  sync: (world: SceneWorld, heightmaps?: ReadonlyMap<string, HeightmapSamples>) => void
  dispose: () => void
}

const PLACEHOLDER = new BoxGeometry(1, 1, 1)
const MATERIAL = new MeshStandardMaterial()

export function createScatterSurface(scene: Scene): ScatterSurface {
  const group = new Group()
  group.name = 'scene-scatter'
  scene.add(group)
  let partition = buildPartition()
  return {
    object: group,
    get partition() {
      return partition
    },
    sync: (world, heightmaps) => {
      clearGroup(group)
      partition = buildPartition()
      const ground = scatterGroundOf(world, heightmaps)
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
      const batches = scatterBatchesOf(poses, partition.cellAt)
      holdScatterCells(batches, partition)
      for (const batch of batches) group.add(scatterDrawnOf(batch, PLACEHOLDER, MATERIAL))
    },
    dispose: () => {
      clearGroup(group)
    },
  }
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
