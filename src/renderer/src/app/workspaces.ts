import {
  mdiCubeOutline,
  mdiImageOutline,
  mdiPanoramaVariantOutline,
  mdiTextureBox,
  mdiVideoOutline,
  mdiVolumeHigh,
} from '@mdi/js'
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

const FAMILIES: Record<WorkspaceId, ModelFamily> = {
  image: 'image',
  video: 'video',
  '3d': '3d',
  audio: 'audio',
  textures: 'image',
  skyboxes: 'image',
}

/**
 * Derived from the shared registry rather than relisted, the way `app/tools.ts` derives from
 * `TOOL_PLACEMENTS`: a seventh workspace is then declared once, and the compiler demands its
 * icon and its family instead of letting the list drift.
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

export { DEFAULT_WORKSPACE } from '@shared/domain/workspace'
export type { WorkspaceId } from '@shared/domain/workspace'
