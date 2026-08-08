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

/** Where a kind is made — the space its generator belongs to. */
export function workspaceOfType(type: AssetType): WorkspaceId {
  return WORKSPACE_OF_TYPE[type]
}

/**
 * What each space has any use for — which is not the reverse of the table above.
 *
 * A space consumes more than it produces: the 3D one takes materials and skies as much as
 * meshes, and the texture one is fed by ordinary pictures. Video takes everything, because a
 * montage is where the others end up.
 *
 * This is what keeps takes out of the way while painting, without hiding anything that space
 * could actually accept — the shelf offers a way back to everything.
 */
const USED_BY_WORKSPACE: Record<WorkspaceId, readonly AssetType[]> = {
  image: ['image', 'texture', 'skybox'],
  video: ['video', 'audio', 'image', 'mesh', 'texture', 'skybox'],
  '3d': ['mesh', 'texture', 'skybox', 'image'],
  audio: ['audio'],
  textures: ['texture', 'image'],
  skyboxes: ['skybox', 'image'],
}

export function assetTypesOf(workspace: WorkspaceId): readonly AssetType[] {
  return USED_BY_WORKSPACE[workspace]
}

const FAMILIES: Record<WorkspaceId, ModelFamily> = {
  image: 'image',
  video: 'video',
  '3d': '3d',
  audio: 'audio',
  textures: 'texture',
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
