import type { WorkspaceId } from './workspace'

/**
 * Document registry, shared by both processes: the native menu will need it for
 * "File ▸ New", and duplicating the type would degrade `DocumentKind` to `string`.
 */
export type DocumentKind = 'image' | 'scene'

export type DocumentDescriptor = {
  id: string
  kind: DocumentKind
  title: string
  workspace: WorkspaceId
}

const KIND_BY_WORKSPACE: Record<WorkspaceId, DocumentKind | null> = {
  image: 'image',
  '3d': 'scene',
  video: null,
  audio: null,
  textures: null,
  skyboxes: null,
}

/** `null` for a workspace whose editor does not exist yet — the new-document button disables. */
export function kindForWorkspace(workspace: WorkspaceId): DocumentKind | null {
  return KIND_BY_WORKSPACE[workspace]
}
