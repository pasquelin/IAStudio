import {
  mdiCubeOutline,
  mdiImageOutline,
  mdiPanoramaVariantOutline,
  mdiTextureBox,
  mdiVideoOutline,
  mdiVolumeHigh,
} from '@mdi/js'
import type { AssetType } from '@shared/domain/asset'

/**
 * What each kind of asset looks like when there is no picture to show. A `Record` rather than a
 * lookup with a fallback: a seventh kind must be a compile error here, not an asset drawn as a
 * broken image somewhere in the browser.
 *
 * Here rather than in `shared/`, which carries no runtime dependency and cannot import `@mdi/js`.
 */
const ICONS: Record<AssetType, string> = {
  image: mdiImageOutline,
  video: mdiVideoOutline,
  audio: mdiVolumeHigh,
  mesh: mdiCubeOutline,
  texture: mdiTextureBox,
  skybox: mdiPanoramaVariantOutline,
}

export function assetIcon(type: AssetType): string {
  return ICONS[type]
}
