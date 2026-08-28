/**
 * What a folder is FOR, told by a marker inside it rather than by its name.
 *
 * A name cannot carry this: the user renames a folder in the Finder and the studio loses the one
 * it files meshes into. The marker travels with the folder — a rename, a move, a copy, a zip, a
 * commit all keep it — so the name on disk becomes the user's, entirely.
 *
 * Ten roles for seven workspaces: Modelling ranges three things, and one folder cannot hold
 * scenes, meshes and motions without becoming the `documents/` this replaced.
 */
export type FolderRole =
  | 'image'
  | 'video'
  | 'audio'
  | 'materials'
  | 'skyboxes'
  | 'code'
  | 'modelling'
  | 'scenes'
  | 'models'
  | 'animations'

/**
 * The values beside the type: a marker read off disk has to be checked against them.
 *
 * 🛑 No identifier may hold a dot. These spell i18n keys — `folderRoles.${role}` — and a dot would
 * make one an extra level of nesting nobody wrote.
 */
export const FOLDER_ROLES: readonly FolderRole[] = [
  'image',
  'video',
  'audio',
  'materials',
  'skyboxes',
  'code',
  'modelling',
  'scenes',
  'models',
  'animations',
]

export function isFolderRole(value: unknown): value is FolderRole {
  return FOLDER_ROLES.some(candidate => candidate === value)
}

/**
 * Where each role STARTS — the tree a new project is given, and the fallback for a role whose
 * folder has gone away.
 *
 * The names are the ENGLISH label of the workspace each serves, and they are fixed: a folder whose
 * name followed the interface language would be renamed on disk at every language change, and
 * every catalogue row under it would point beside the file. The interface says «Modélisation» by
 * translating the ROLE, never by touching the disk.
 *
 * Only a default: the marker is what binds a role to a folder, so any of these may be renamed,
 * moved or nested and go on serving.
 */
export const DEFAULT_ROLE_PATHS: Record<FolderRole, string> = {
  image: 'Images',
  video: 'Video',
  audio: 'Audio',
  materials: 'Materials',
  skyboxes: 'Skyboxes',
  code: 'Scripts',
  modelling: 'Modelling',
  scenes: 'Modelling/Scenes',
  models: 'Modelling/Models',
  animations: 'Modelling/Animations',
}

/**
 * The file that says a folder's role, holding the role and nothing else.
 *
 * Inside the folder rather than in a table elsewhere, which is the whole mechanism: a table keyed
 * by path is stale the moment the Finder renames anything, where a file the folder CARRIES is
 * never wrong. Dotted so every platform hides it, and `hideFromExplorer` gives Windows the
 * attribute it wants on top.
 */
export const ROLE_MARKER = '.ia-studio-role'

/**
 * Where the roles were last found, by role. Partial on purpose: a role whose folder was thrown
 * away has no path until something needs to write one, and an entry that lied would be worse than
 * an entry that is absent.
 */
export type RoleFolders = Partial<Record<FolderRole, string>>

/** The folder a role names, or where it starts when nothing has been resolved for it. */
export function folderForRole(role: FolderRole, roles?: RoleFolders): string {
  return roles?.[role] ?? DEFAULT_ROLE_PATHS[role]
}

/**
 * The role a folder plays, or `null` for an ordinary folder — read against the RESOLVED map, so a
 * renamed folder answers and a fresh one wearing the old default name does not.
 */
export function roleOfFolder(path: string, roles: RoleFolders): FolderRole | null {
  return FOLDER_ROLES.find(role => roles[role] === path) ?? null
}

/**
 * Which of two folders claiming one role wins: the shallower, then the earlier by code unit.
 *
 * A copied folder brings its marker, so two claims is an ordinary accident rather than a corrupt
 * project. Deciding by depth puts the original ahead of a copy filed under it, and the tie-break
 * is by code unit rather than by locale — a project must resolve the same way on every machine.
 */
export function preferredRoleFolder(one: string, other: string): string {
  const depth = one.split('/').length - other.split('/').length
  if (depth !== 0) return depth < 0 ? one : other

  return one < other ? one : other
}
