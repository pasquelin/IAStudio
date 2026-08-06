import {
  mdiCubeOutline,
  mdiImageOutline,
  mdiPanoramaVariantOutline,
  mdiTextureBox,
  mdiVideoOutline,
  mdiVolumeHigh,
} from '@mdi/js'
import type { ModelFamily } from '@shared/domain/model'

export type WorkspaceId = 'image' | 'video' | '3d' | 'audio' | 'textures' | 'skyboxes'

export type Workspace = {
  id: WorkspaceId
  icon: string
  /** Scenario model family the generator offers in this workspace. */
  family: ModelFamily
}

export const WORKSPACES: readonly Workspace[] = [
  { id: 'image', icon: mdiImageOutline, family: 'image' },
  { id: 'video', icon: mdiVideoOutline, family: 'video' },
  { id: '3d', icon: mdiCubeOutline, family: '3d' },
  { id: 'audio', icon: mdiVolumeHigh, family: 'audio' },
  { id: 'textures', icon: mdiTextureBox, family: 'image' },
  { id: 'skyboxes', icon: mdiPanoramaVariantOutline, family: 'image' },
]

export const DEFAULT_WORKSPACE: WorkspaceId = 'image'

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
