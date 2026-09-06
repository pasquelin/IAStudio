import { Light, type Box3, type Camera, type InstancedMesh, type Object3D } from 'three'
import { growShadowBounds } from '@/engines/scene/shadows'
import type { InstancedGroups, ShadowThrow } from '@/engines/scene/grouping'
import type { WorldDrape } from './gameSceneWorld'

/** What one flush of a game scene changed — enough for the draw to know which passes it owes. */
export type GameFlush = {
  /** Scatter or instanced cells appeared or left. */
  zoned: boolean
  /** A caster walked outside the box the maps were cut to, or a light turned. */
  reframed: boolean
}

export type GameFrameParts = {
  drape: WorldDrape
  instances: InstancedGroups
  staleInstances: Set<InstancedMesh>
  movedObjects: Set<Object3D>
  shadowBounds: Box3
}

/** The editor's own skip: a still picture keeps the canvas it already shows. */
export function frameOwesDraw(
  settled: GameFlush,
  shadowsStale: boolean,
  pictureStale: boolean,
): boolean {
  return pictureStale || shadowsStale || settled.zoned || settled.reframed
}

/**
 * Settles instanced bounds, scatter, spatial cells and the shadow box — the editor's `dressPane`
 * follow plus the scatter pass, in the one call a game frame makes.
 */
export function settleGameFrame(
  parts: GameFrameParts,
  camera: Camera,
  cast: ShadowThrow | null,
): GameFlush {
  const { drape, instances, staleInstances, movedObjects, shadowBounds } = parts
  const scattered = drape.updateVisibility(camera)
  const zoned = instances.follow?.(camera, cast) ?? false
  for (const mesh of staleInstances) {
    mesh.instanceMatrix.needsUpdate = true
    mesh.computeBoundingSphere()
  }

  const casters: Object3D[] = []
  let lightMoved = false
  for (const object of movedObjects) {
    if (object instanceof Light) lightMoved = true
    else casters.push(object)
  }
  const grown = growShadowBounds(shadowBounds, casters)
  staleInstances.clear()
  movedObjects.clear()
  return { zoned: scattered || zoned, reframed: grown || lightMoved }
}
