/**
 * Workspace registry, shared by both processes. It sits here for the same reason as
 * `domain/tool.ts`: the document domain needs `WorkspaceId`, and `shared/` cannot import from
 * the renderer. The renderer enriches these ids with icons and model families.
 */
export type WorkspaceId = 'image' | 'video' | '3d' | 'audio' | 'textures' | 'skyboxes' | 'graph'

/**
 * Rail order, and `graph` comes last on purpose: it is the one space that produces no asset
 * type of its own — it chains the six that do — so it stands after them rather than among them.
 */
export const WORKSPACE_IDS: readonly WorkspaceId[] = [
  'image',
  'video',
  '3d',
  'audio',
  'textures',
  'skyboxes',
  'graph',
]

export const DEFAULT_WORKSPACE: WorkspaceId = 'image'
