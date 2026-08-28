import {
  mdiCodeBraces,
  mdiCubeOutline,
  mdiCubeScan,
  mdiImageOutline,
  mdiPanoramaVariantOutline,
  mdiRunFast,
  mdiTextureBox,
  mdiVectorTriangle,
  mdiVideoOutline,
  mdiVolumeHigh,
} from '@mdi/js'
import type { FolderRole } from '@shared/domain/folderRole'

/**
 * The glyph a folder serving a role wears, in place of the plain folder.
 *
 * It is the ONLY thing on screen that says a folder is one: the NAME shown is always the disk's,
 * renamed or not, so that what the eye reads is what the Finder reads. The role is told by the
 * glyph and spelt out by the row's hint, which is translated where the folder can never be.
 *
 * Seven repeat their workspace's, and that is the point — a folder wears the glyph of the section
 * it serves. The three under Modelling get their own: the section's cube on all three would say
 * they are the same shelf, which is exactly what this rework took apart.
 */
export const ROLE_ICONS: Record<FolderRole, string> = {
  image: mdiImageOutline,
  video: mdiVideoOutline,
  audio: mdiVolumeHigh,
  materials: mdiTextureBox,
  skyboxes: mdiPanoramaVariantOutline,
  code: mdiCodeBraces,
  modelling: mdiCubeOutline,
  scenes: mdiCubeScan,
  models: mdiVectorTriangle,
  animations: mdiRunFast,
}
