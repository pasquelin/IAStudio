import type { ReliefMask } from './relief'
import { RELIEF_CHUNK_TEXELS } from './relief'

/**
 * One prop a scatter layer may draw. Several entries share one placement mask; `weight` is the
 * draw chance among them at each accepted point, not a density of its own.
 */
export type ScatterAsset = { assetId: string; weight: number }

/**
 * How a scatter layer answers a relief sculpt. `none` keeps the last poses; `brush` rebuilds the
 * dirtied chunks only; `layer` rebuilds the whole layer.
 */
export type ScatterFollowRelief = 'none' | 'brush' | 'layer'

export const SCATTER_FOLLOW_RELIEF: readonly ScatterFollowRelief[] = ['none', 'brush', 'layer']

/**
 * Placement rules for one scatter layer. `waterDistance` and `roadDistance` are stored so a later
 * Water/Spline lot can consume them — the generator ignores both until those layers exist.
 */
export type ScatterRules = {
  /** Accepted points per square metre, before spacing and the mask thin them. */
  density: number
  /** Minimum metres between two accepted points. */
  spacing: number
  minScale: number
  maxScale: number
  randomRotation: boolean
  /** Extra tilt in degrees, on top of slope alignment. */
  randomTilt: number
  /** 0 = world-up, 100 = terrain normal. */
  slopeAlign: number
  altitudeMin: number
  altitudeMax: number
  slopeMin: number
  slopeMax: number
  waterDistance?: number
  roadDistance?: number
}

/**
 * Trees, rocks, bushes — density in the hundreds of thousands globally, never a grass carpet.
 * Instances are not scene nodes: they are edited in bulk, like a sculpt. Origin/size/grain give
 * the painted mask its world mapping; they are not a second heightmap.
 */
export type ScatterLayer = {
  kind: 'scatter'
  id: string
  name: string
  enabled: boolean
  locked: boolean
  assets: readonly ScatterAsset[]
  mask?: ReliefMask
  seed: number
  rules: ScatterRules
  collision: boolean
  followRelief: ScatterFollowRelief
  origin: { x: number; z: number }
  size: { x: number; z: number }
  grain: number
}

export const DEFAULT_SCATTER_NAME = 'Scatter'

/** Square painted-mask grid, independent of the heightmap. 256² is 4×4 chunks at grain 64. */
export const SCATTER_MASK_TEXELS = 256

/**
 * 4096 capsules: a 64×64 m patch at 1 instance/m² with collision on. Past that the editor's
 * physics step is the freeze risk, not the draw. Chosen before measurement; the collision
 * step records the number this build actually spends.
 */
export const SCATTER_COLLISION_CAP = 4096

export const DEFAULT_SCATTER_RULES: ScatterRules = Object.freeze({
  density: 0.1,
  spacing: 2,
  minScale: 0.8,
  maxScale: 1.2,
  randomRotation: true,
  randomTilt: 0,
  slopeAlign: 0,
  altitudeMin: -1000,
  altitudeMax: 1000,
  slopeMin: 0,
  slopeMax: 90,
})

export const SCATTER_DENSITY = Object.freeze({ min: 0, max: 2, step: 0.01 })
export const SCATTER_SPACING = Object.freeze({ min: 0, max: 50, step: 0.1 })
export const SCATTER_SCALE = Object.freeze({ min: 0.01, max: 20, step: 0.01 })
export const SCATTER_TILT = Object.freeze({ min: 0, max: 45, step: 1 })
export const SCATTER_SLOPE_ALIGN = Object.freeze({ min: 0, max: 100, step: 1 })
export const SCATTER_ALTITUDE = Object.freeze({ min: -10_000, max: 10_000, step: 0.1 })
export const SCATTER_SLOPE = Object.freeze({ min: 0, max: 90, step: 1 })

/** Matches `DEFAULT_RELIEF_ORIGIN` / `DEFAULT_RELIEF_SIZE` without importing `scene`. */
const DEFAULT_ORIGIN = Object.freeze({ x: 0, z: 0 })
const DEFAULT_SIZE = Object.freeze({ x: 20, z: 20 })

export function scatterLayer(
  patch: Partial<Omit<ScatterLayer, 'kind'>> & { id: string },
): ScatterLayer {
  return {
    kind: 'scatter',
    id: patch.id,
    name: patch.name ?? DEFAULT_SCATTER_NAME,
    enabled: patch.enabled ?? true,
    locked: patch.locked ?? false,
    assets: patch.assets ?? [],
    seed: patch.seed ?? 1,
    rules: scatterRules(patch.rules),
    collision: patch.collision ?? false,
    followRelief: patch.followRelief ?? 'brush',
    origin: patch.origin ?? DEFAULT_ORIGIN,
    size: patch.size ?? DEFAULT_SIZE,
    grain: patch.grain ?? RELIEF_CHUNK_TEXELS,
    ...(patch.mask ? { mask: patch.mask } : {}),
  }
}

function scatterRules(patch: Partial<ScatterRules> | undefined): ScatterRules {
  const rules: ScatterRules = {
    density: patch?.density ?? DEFAULT_SCATTER_RULES.density,
    spacing: patch?.spacing ?? DEFAULT_SCATTER_RULES.spacing,
    minScale: patch?.minScale ?? DEFAULT_SCATTER_RULES.minScale,
    maxScale: patch?.maxScale ?? DEFAULT_SCATTER_RULES.maxScale,
    randomRotation: patch?.randomRotation ?? DEFAULT_SCATTER_RULES.randomRotation,
    randomTilt: patch?.randomTilt ?? DEFAULT_SCATTER_RULES.randomTilt,
    slopeAlign: patch?.slopeAlign ?? DEFAULT_SCATTER_RULES.slopeAlign,
    altitudeMin: patch?.altitudeMin ?? DEFAULT_SCATTER_RULES.altitudeMin,
    altitudeMax: patch?.altitudeMax ?? DEFAULT_SCATTER_RULES.altitudeMax,
    slopeMin: patch?.slopeMin ?? DEFAULT_SCATTER_RULES.slopeMin,
    slopeMax: patch?.slopeMax ?? DEFAULT_SCATTER_RULES.slopeMax,
  }
  if (patch?.waterDistance !== undefined) rules.waterDistance = patch.waterDistance
  if (patch?.roadDistance !== undefined) rules.roadDistance = patch.roadDistance
  return rules
}
