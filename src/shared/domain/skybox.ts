import type { AdjustmentStack } from './adjustments'
import { NEUTRAL_ADJUSTMENTS } from './adjustments'
import type { SphericalAngles } from './angles'
import type { TextureRef } from './scene'

/**
 * A skybox is one equirectangular image — the only shape a diffusion model can produce
 * coherently — and six square faces derived from it, which is the shape engines sample. See
 * spec § 2: the workspace exists to carry a picture from the first form to the second.
 */

/**
 * Cube map faces in three.js order, which is also the order WebGL uploads them in and the
 * order `WebGLCubeRenderTarget` stores them. Every table below keys off it, so a face can
 * never be read at the wrong index.
 */
export type CubeFace = 'px' | 'nx' | 'py' | 'ny' | 'pz' | 'nz'

export const CUBE_FACES: readonly CubeFace[] = ['px', 'nx', 'py', 'ny', 'pz', 'nz']

export function isCubeFace(value: unknown): value is CubeFace {
  return CUBE_FACES.some(candidate => candidate === value)
}

/**
 * The interchange name of each face. Engines name faces by where they sit, not by their axis,
 * and every exporter reuses these two letters — Roblox spells them `SkyboxRt`, others `_rt`.
 * Keeping the mapping here means an exporter never rediscovers which axis is "right".
 */
export type FaceLabel = 'Rt' | 'Lf' | 'Up' | 'Dn' | 'Ft' | 'Bk'

export const FACE_LABELS: Record<CubeFace, FaceLabel> = {
  px: 'Rt',
  nx: 'Lf',
  py: 'Up',
  ny: 'Dn',
  pz: 'Ft',
  nz: 'Bk',
}

/** Where each face sits on the 4:3 cross, in cells from the top-left of a 4×3 grid. */
export const CROSS_CELLS: Record<CubeFace, { column: number; row: number }> = {
  py: { column: 1, row: 0 },
  nx: { column: 0, row: 1 },
  pz: { column: 1, row: 1 },
  px: { column: 2, row: 1 },
  nz: { column: 3, row: 1 },
  ny: { column: 1, row: 2 },
}

export const CROSS_COLUMNS = 4
export const CROSS_ROWS = 3

/**
 * The sun, as two angles rather than a position. The angles are the truth and the light is
 * derived from them: the viewport drags one end and the panel types the other, and a position
 * held as truth would make the two disagree the first time a drag crosses the zenith.
 */
export type SunSettings = SphericalAngles & {
  intensity: number
  /** Hex, the form the palette and the light descriptors already use. */
  color: string
}

export const DEFAULT_SUN: SunSettings = {
  elevation: Math.PI / 6,
  azimuth: 0,
  intensity: 1,
  color: '#ffffff',
}

/** How the same data is drawn. Only `immersive` is a 3D scene; the rest are flat layouts. */
export type SkyboxView = 'immersive' | 'equirect' | 'cross' | 'faces'

export const SKYBOX_VIEWS: readonly SkyboxView[] = ['immersive', 'equirect', 'cross', 'faces']

export const MIN_FIELD_OF_VIEW = 50
export const MAX_FIELD_OF_VIEW = 110
export const DEFAULT_FIELD_OF_VIEW = 75

/** Face sizes offered on export. Powers of two: engines sample cube maps by hardware. */
export const FACE_SIZES: readonly number[] = [512, 1024, 2048]

export type SkyboxEnvironment = {
  /** Multiplies the image-based lighting the test objects and the ground receive. */
  intensity: number
  showBackground: boolean
}

export const DEFAULT_ENVIRONMENT: SkyboxEnvironment = { intensity: 1, showBackground: true }

/**
 * What a `.sky` holds on disk. The view mode, the field of view and the test objects are
 * deliberately absent: they are how the document is being looked at right now, not what it is,
 * and persisting them would make a reopened document argue with the window it opens in.
 */
export type SkyboxContent = {
  /** The equirectangular source. `null` until a generation or an import fills it. */
  source: TextureRef | null
  adjustments: AdjustmentStack
  sun: SunSettings
  environment: SkyboxEnvironment
  generation?: { modelId: string; modelLabel: string; prompt: string; seed?: number }
}

export function createSkyboxContent(): SkyboxContent {
  return {
    source: null,
    adjustments: { ...NEUTRAL_ADJUSTMENTS },
    sun: { ...DEFAULT_SUN },
    environment: { ...DEFAULT_ENVIRONMENT },
  }
}
