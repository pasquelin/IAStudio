/**
 * The four working textures the app ships with — a grid and a checker, each at two densities.
 *
 * What they are FOR: judging scale, seeing UVs stretch, and telling one face of a primitive from
 * another. Every modelling package ships something like them, and a grey primitive tells none of
 * those three things.
 *
 * They are ordinary PNG files under `resources/textures`, copied into the project the first time
 * a scene wants one and referenced like any other asset from then on. Not a texture the engine
 * invents: a document holds an asset id, and a `.gltf` has to point at an image that exists.
 */
export type CheckerTextureId = 'gridLarge' | 'gridSmall' | 'checkerLarge' | 'checkerSmall'

export const CHECKER_TEXTURE_IDS: readonly CheckerTextureId[] = [
  'gridLarge',
  'gridSmall',
  'checkerLarge',
  'checkerSmall',
]

/**
 * What a primitive is born wearing. The large checker rather than a grid: alternating squares
 * show a stretched UV that even lines hide, and at this density they read on a cube of one unit
 * as well as on a floor of twenty.
 */
export const DEFAULT_CHECKER_TEXTURE: CheckerTextureId = 'checkerLarge'

/**
 * The name each one carries into a project — its file's stem, which is what an asset is named
 * by. English and fixed like every other folder and file the studio writes.
 */
export const CHECKER_TEXTURE_NAMES: Record<CheckerTextureId, string> = {
  gridLarge: 'GridLarge',
  gridSmall: 'GridSmall',
  checkerLarge: 'CheckerLarge',
  checkerSmall: 'CheckerSmall',
}

export function checkerTextureFile(id: CheckerTextureId): string {
  return `${CHECKER_TEXTURE_NAMES[id]}.png`
}

/** What one of them lands in the project as: the id it was given, and the row it now has. */
export type InstalledCheckerTexture = { id: CheckerTextureId; assetId: string }
