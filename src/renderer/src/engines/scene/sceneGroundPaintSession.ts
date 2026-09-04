import type { GroundPaint } from '@shared/domain/groundPaint'
import type { SceneWorld } from '@shared/domain/scene'
import { groundPaintedAt, type HeldGroundPaint } from './sceneSurfacePaint'

type Disk = { x: number; z: number; radius: number; amount: number; falloff: number }

export type SceneGroundPaintSession = {
  clear: () => void
  paint: (terrainId: string, disk: Disk) => Promise<boolean>
  finish: () => Promise<void>
}

export function createSceneGroundPaintSession(options: {
  world: () => SceneWorld
  load?: (terrainId: string) => Promise<GroundPaint | null>
  apply: (terrainId: string, paint: GroundPaint) => void
}): SceneGroundPaintSession {
  const held = new Map<string, HeldGroundPaint>()
  let task: Promise<boolean> = Promise.resolve(false)
  return {
    clear: () => held.clear(),
    paint: (terrainId, disk) => {
      task = paintAfter(task, options, held, terrainId, disk)
      return task
    },
    finish: async () => {
      await task
    },
  }
}

async function paintAfter(
  previous: Promise<boolean>,
  options: {
    world: () => SceneWorld
    load?: (terrainId: string) => Promise<GroundPaint | null>
    apply: (terrainId: string, paint: GroundPaint) => void
  },
  held: Map<string, HeldGroundPaint>,
  terrainId: string,
  disk: Disk,
): Promise<boolean> {
  await previous
  const world = options.world()
  const paint = await groundPaintedAt(world, held, options.load, terrainId, disk)
  if (!paint) return false
  const terrain = world.layers.find(item => item.kind === 'relief' && item.id === terrainId)
  const assetId =
    terrain?.kind === 'relief'
      ? (terrain.groundWeights?.assetId ?? terrain.groundMaterials[0]?.albedo.assetId)
      : undefined
  held.set(terrainId, { assetId: assetId ?? null, paint })
  options.apply(terrainId, paint)
  return true
}
