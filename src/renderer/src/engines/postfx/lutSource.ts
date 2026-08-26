/**
 * A LUT of the project, read into the 3D texture the grade samples.
 *
 * A lookup table is stored as a plain PICTURE — a horizontal strip of slices, which is what
 * `LUTImageLoader` reads — and therefore lives in the catalogue as a texture like any other:
 * it has a thumbnail, a version, a folder, and it travels with the project. A second asset kind
 * for the same bytes would have bought nothing.
 */
import type { Data3DTexture } from 'three'
import { LUTImageLoader } from 'three/addons/loaders/LUTImageLoader.js'
import { assetUrl, versionedUrl } from '@shared/domain/asset'

const loader = new LUTImageLoader()

/**
 * `version` is what makes ⌘S over a LUT show: the id never moves, so without a stamp the browser
 * answers the picture it already had — the same rule `textureCache` follows for every map.
 */
export async function loadLutTexture(
  assetId: string,
  version?: string,
): Promise<Data3DTexture | null> {
  const read = await loader.loadAsync(versionedUrl(assetUrl(assetId), version))
  return read.texture3D
}
