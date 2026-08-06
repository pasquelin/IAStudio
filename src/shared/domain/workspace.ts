/**
 * Workspace registry, shared by both processes. It sits here for the same reason as
 * `domain/tool.ts`: the document domain needs `WorkspaceId`, and `shared/` cannot import from
 * the renderer. The renderer enriches these ids with icons and model families.
 */
export type WorkspaceId = 'image' | 'video' | '3d' | 'audio' | 'textures' | 'skyboxes'

export const WORKSPACE_IDS: readonly WorkspaceId[] = [
  'image',
  'video',
  '3d',
  'audio',
  'textures',
  'skyboxes',
]

export const DEFAULT_WORKSPACE: WorkspaceId = 'image'
