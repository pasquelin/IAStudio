import type { AssetGeneration } from './asset'
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
 * The same six faces packed 3×2, in the canonical order. The cross reads as a space and spends
 * half its cells on nothing; this one spends none, so a face is inspected at nearly twice the
 * size — which is the whole reason to offer both.
 */
export const GRID_CELLS: Record<CubeFace, { column: number; row: number }> = {
  px: { column: 0, row: 0 },
  nx: { column: 1, row: 0 },
  py: { column: 2, row: 0 },
  ny: { column: 0, row: 1 },
  pz: { column: 1, row: 1 },
  nz: { column: 2, row: 1 },
}

export const GRID_COLUMNS = 3
export const GRID_ROWS = 2

/** One axis, as x/y/z. A tuple rather than a `Vector3`: `shared/` carries no runtime dependency. */
export type FaceAxis = readonly [number, number, number]

/**
 * The basis of one face: where its centre points, where a pixel travels as the picture goes
 * right, and where it travels as the picture goes UP.
 *
 * These are the OpenGL cube map conventions, which is what every engine named in `FACE_LABELS`
 * samples — `up` is the opposite of the `t` axis, because a face is stored with its first row at
 * the top. A face drawn on any other basis lands mirrored or a quarter turn out, and nothing in
 * the picture says which. `forward` is `right × up` for all six; the test derives it rather than
 * trusting the table to be typed correctly.
 */
export type FaceBasis = { forward: FaceAxis; right: FaceAxis; up: FaceAxis }

export const FACE_BASES: Record<CubeFace, FaceBasis> = {
  px: { forward: [1, 0, 0], right: [0, 0, -1], up: [0, 1, 0] },
  nx: { forward: [-1, 0, 0], right: [0, 0, 1], up: [0, 1, 0] },
  py: { forward: [0, 1, 0], right: [1, 0, 0], up: [0, 0, -1] },
  ny: { forward: [0, -1, 0], right: [1, 0, 0], up: [0, 0, 1] },
  pz: { forward: [0, 0, 1], right: [1, 0, 0], up: [0, 1, 0] },
  nz: { forward: [0, 0, -1], right: [-1, 0, 0], up: [0, 1, 0] },
}

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

/** The views that lay the picture flat, and so have a layout rather than a camera. */
export type FlatSkyboxView = Exclude<SkyboxView, 'immersive'>

export function isFlatView(view: SkyboxView): view is FlatSkyboxView {
  return view !== 'immersive'
}

/** Pixels, with `y` measured from the TOP — the frame as a picture, not as a WebGL buffer. */
export type LayoutRect = { x: number; y: number; width: number; height: number }

const FACE_GRIDS: Record<
  Exclude<FlatSkyboxView, 'equirect'>,
  { columns: number; rows: number; cells: Record<CubeFace, { column: number; row: number }> }
> = {
  cross: { columns: CROSS_COLUMNS, rows: CROSS_ROWS, cells: CROSS_CELLS },
  faces: { columns: GRID_COLUMNS, rows: GRID_ROWS, cells: GRID_CELLS },
}

/**
 * The largest `columns × rows` block of whole SQUARE cells that fits in the frame, centred.
 *
 * Whole cells, never a scaled rectangle: each one becomes a scissor box, and a fractional box is
 * rounded by the driver on its own terms — two neighbours would then disagree by a pixel and
 * leave a thread of the previous frame between them. Returns a zero cell for a frame too small
 * to hold one, which is what a caller checks instead of drawing a degenerate rectangle.
 */
export function cellGridOf(
  columns: number,
  rows: number,
  width: number,
  height: number,
): { cell: number; x: number; y: number } {
  const cell = Math.max(0, Math.floor(Math.min(width / columns, height / rows)))
  return {
    cell,
    x: Math.floor((width - cell * columns) / 2),
    y: Math.floor((height - cell * rows) / 2),
  }
}

/** The equirectangular picture itself, at its own 2:1, centred in the frame. */
export function equirectRectOf(width: number, height: number): LayoutRect {
  const { cell, x, y } = cellGridOf(2, 1, width, height)
  return { x, y, width: cell * 2, height: cell }
}

/**
 * Where each face is drawn, in the order faces are named. Both flat face views are the same
 * pavement with a different table, so a cross and a grid can never drift apart on how they
 * centre, round or scale.
 */
export function faceTilesOf(
  view: Exclude<FlatSkyboxView, 'equirect'>,
  width: number,
  height: number,
): { face: CubeFace; rect: LayoutRect }[] {
  const { columns, rows, cells } = FACE_GRIDS[view]
  const { cell, x, y } = cellGridOf(columns, rows, width, height)
  if (cell === 0) return []

  return CUBE_FACES.map(face => ({
    face,
    rect: {
      x: x + cells[face].column * cell,
      y: y + cells[face].row * cell,
      width: cell,
      height: cell,
    },
  }))
}

/**
 * The same rectangle as WebGL wants it: `y` from the BOTTOM. `setViewport` and `setScissor` both
 * measure from there, and a rectangle handed over unconverted puts the ground in the sky — which
 * is a layout that looks deliberate.
 */
export function scissorOf(rect: LayoutRect, frameHeight: number): LayoutRect {
  return { ...rect, y: frameHeight - rect.y - rect.height }
}

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
  /**
   * What produced the picture, stated once rather than respelled: the catalogue is expected to
   * start recording `AssetGeneration`, and a field added there must reach a sky too. `params`
   * is dropped because a document is not a form — "regenerate" reads the job, not this.
   */
  generation?: Omit<AssetGeneration, 'params'>
}

export function createSkyboxContent(): SkyboxContent {
  return {
    source: null,
    adjustments: { ...NEUTRAL_ADJUSTMENTS },
    sun: { ...DEFAULT_SUN },
    environment: { ...DEFAULT_ENVIRONMENT },
  }
}
