import { BoxGeometry, InstancedMesh, LOD, Mesh, MeshStandardMaterial, Object3D } from 'three'
import { describe, expect, it } from 'vitest'
import type { ScatterPose } from '@shared/domain/scatterGenerate'
import { holdScatterCells, scatterBatchesOf, scatterDrawnOf } from './scatterRender'
import { buildPartition, CELL_SIZE } from './worldPartition'

function pose(assetId: string, x: number, z: number): ScatterPose {
  return {
    assetId,
    x,
    y: 0,
    z,
    scale: 1,
    rotation: { x: 0, y: 0, z: 0 },
  }
}

describe('scatterBatchesOf', () => {
  it('opens one batch per asset and world-partition cell, never one per pose', () => {
    const poses = [
      pose('pine', 1, 1),
      pose('pine', 2, 2),
      pose('oak', 3, 3),
      pose('pine', CELL_SIZE + 1, 1),
    ]
    const batches = scatterBatchesOf(poses)
    expect(batches).toHaveLength(3)
    expect(batches.map(batch => `${batch.assetId}:${batch.poses.length}`).sort()).toEqual([
      'oak:1',
      'pine:1',
      'pine:2',
    ])
  })
})

describe('scatterDrawnOf', () => {
  it('draws a batch as one InstancedMesh wrapped in a cell LOD, not one mesh per pose', () => {
    const geometry = new BoxGeometry(1, 1, 1)
    const material = new MeshStandardMaterial()
    const batch = scatterBatchesOf([pose('pine', 0, 0), pose('pine', 1, 0), pose('pine', 2, 0)])[0]
    if (!batch) throw new Error('expected a batch')
    const drawn = scatterDrawnOf(batch, new Mesh(geometry, material))
    expect(drawn).toBeInstanceOf(LOD)
    const mesh = drawn.levels[0]?.object
    expect(mesh).toBeInstanceOf(InstancedMesh)
    expect(mesh instanceof InstancedMesh ? mesh.count : 0).toBe(3)
    expect(drawn.levels).toHaveLength(3)
    expect(drawn.levels[1]?.object).toBeInstanceOf(InstancedMesh)
    expect(
      drawn.levels[1]?.object instanceof InstancedMesh ? drawn.levels[1].object.count : 0,
    ).toBe(1)
    expect(drawn.levels[2]?.object).toBeInstanceOf(Object3D)
    expect(drawn.levels[2]?.object instanceof InstancedMesh).toBe(false)
    expect(drawn.levels.map(level => level.distance)).toEqual([
      0,
      expect.any(Number),
      expect.any(Number),
    ])
    expect(drawn.levels[2]?.distance ?? 0).toBeGreaterThan(drawn.levels[1]?.distance ?? 0)
    expect(drawn.position.toArray()).toEqual([CELL_SIZE / 2, 0, CELL_SIZE / 2])
  })
})

describe('holdScatterCells', () => {
  it('registers each occupied cell once on the world partition', () => {
    const partition = buildPartition()
    const batches = scatterBatchesOf([
      pose('pine', 1, 1),
      pose('oak', 2, 2),
      pose('pine', CELL_SIZE + 1, 1),
    ])
    holdScatterCells(batches, partition)
    expect(partition.stats().cells).toBe(2)
  })
})
