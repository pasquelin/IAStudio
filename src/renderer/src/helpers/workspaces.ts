import {
  mdiCubeOutline,
  mdiImageOutline,
  mdiPanoramaVariantOutline,
  mdiTextureBox,
  mdiVideoOutline,
  mdiVolumeHigh,
} from '@mdi/js'
import type { AssetType } from '@shared/domain/asset'
import type { ModelFamily } from '@shared/domain/model'
import { WORKSPACE_IDS, type WorkspaceId } from '@shared/domain/workspace'

export type Workspace = {
  id: WorkspaceId
  icon: string
  /** Scenario model family the generator offers in this workspace. */
  family: ModelFamily
}

const ICONS: Record<WorkspaceId, string> = {
  image: mdiImageOutline,
  video: mdiVideoOutline,
  '3d': mdiCubeOutline,
  audio: mdiVolumeHigh,
  textures: mdiTextureBox,
  skyboxes: mdiPanoramaVariantOutline,
}

/**
 * Which workspace an asset belongs to. `Record` both ways, so a seventh kind or a seventh
 * workspace is a compile error rather than an asset drawn under the wrong glyph.
 */
const WORKSPACE_OF_TYPE: Record<AssetType, WorkspaceId> = {
  image: 'image',
  video: 'video',
  audio: 'audio',
  mesh: '3d',
  texture: 'textures',
  skybox: 'skyboxes',
}

/**
 * What stands for an asset when there is no picture to show it by. Read off the workspace table
 * rather than relisted: changing the video glyph in the rail must change it on the tiles too.
 */
export function assetIcon(type: AssetType): string {
  return ICONS[WORKSPACE_OF_TYPE[type]]
}

const FAMILIES: Record<WorkspaceId, ModelFamily> = {
  image: 'image',
  video: 'video',
  '3d': '3d',
  audio: 'audio',
  textures: 'image',
  skyboxes: 'skybox',
}

/**
 * Derived from the shared registry rather than relisted, the way `tool-registry.ts` derives
 * from `TOOL_PLACEMENTS`: a seventh workspace is then declared once, and the compiler demands
 * its icon and its family instead of letting the list drift.
 */
export const WORKSPACES: readonly Workspace[] = WORKSPACE_IDS.map(id => ({
  id,
  icon: ICONS[id],
  family: FAMILIES[id],
}))

/** i18n key of a workspace label — the label is never hardcoded. */
export function workspaceLabelKey(id: WorkspaceId): string {
  return `workspaces.${id}`
}

/**
 * Takes a plain string: the id may come from a persisted layout or from IPC, which is
 * exactly the case this function exists to reject.
 */
export function workspaceById(id: string): Workspace {
  const workspace = WORKSPACES.find(candidate => candidate.id === id)
  if (!workspace) throw new Error(`Unknown workspace: ${id}`)
  return workspace
}
