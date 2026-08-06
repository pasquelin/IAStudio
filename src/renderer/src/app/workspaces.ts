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
  /** Famille de modèles Scenario proposée par le générateur dans cet espace. */
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

/** Clé i18n du libellé d'un espace — le libellé n'est jamais écrit en dur. */
export function workspaceLabelKey(id: WorkspaceId): string {
  return `workspaces.${id}`
}

export function workspaceById(id: WorkspaceId): Workspace {
  const workspace = WORKSPACES.find(candidate => candidate.id === id)
  if (!workspace) throw new Error(`Unknown workspace: ${id}`)
  return workspace
}
