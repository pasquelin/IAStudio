import { mkdir, readFile } from 'node:fs/promises'
import { join } from 'node:path'
import { nameOf, parentOf } from '@shared/domain/folder'
import {
  DEFAULT_ROLE_PATHS,
  FOLDER_ROLES,
  isFolderRole,
  preferredRoleFolder,
  ROLE_MARKER,
  type FolderRole,
  type RoleFolders,
} from '@shared/domain/folderRole'
import { INDEX_FOLDER } from '@shared/domain/project'
import { exists, writeAtomic } from '@main/persistence'
import { log } from '@main/log'
import { createFolderReader } from './folder'
import { hideFromExplorer } from './hideFromExplorer'

/**
 * Where the last resolution was written down. Under `.index/` because it is exactly what that
 * folder is for: something the studio can throw away and rebuild by walking.
 *
 * A CACHE and never the answer. What binds a role to a folder is the marker the folder carries;
 * this only spares the walk when nothing has moved.
 */
export const ROLE_CACHE_FILE = `${INDEX_FOLDER}/folder-roles.json`

/** Whether this folder still carries this role — one read, and the only thing worth trusting. */
async function carriesRole(root: string, folder: string, role: FolderRole): Promise<boolean> {
  try {
    return (await readFile(join(root, folder, ROLE_MARKER), 'utf8')).trim() === role
  } catch {
    return false
  }
}

/** Lays a folder down and says what it is for. The marker is written last: a folder that failed
 * to appear must not leave a claim behind. */
export async function markRoleFolder(
  root: string,
  folder: string,
  role: FolderRole,
): Promise<void> {
  await mkdir(join(root, folder), { recursive: true })
  await writeAtomic(join(root, folder, ROLE_MARKER), `${role}\n`)
  await hideFromExplorer(join(root, folder, ROLE_MARKER))
}

/**
 * The tree a new project is given, each folder carrying the marker that says what it is for.
 *
 * Ordinary folders from the first second: renamed, moved, filled or thrown away like any the
 * user makes, and it is the marker rather than this layout that keeps a role bound to one.
 */
export async function layRoleFolders(root: string): Promise<void> {
  // One at a time up the nesting, since `Modelling/Models` and `Modelling` are the same mkdir
  // twice over — and in parallel the marker of the parent races the creation of the child.
  for (const role of FOLDER_ROLES) await markRoleFolder(root, DEFAULT_ROLE_PATHS[role], role)
}

/** What the cache holds, checked rather than trusted: it is a file on a disk anyone may edit. */
function parseCache(body: string): RoleFolders {
  const read: unknown = JSON.parse(body)
  if (typeof read !== 'object' || read === null) return {}

  const held: RoleFolders = {}
  for (const [role, folder] of Object.entries(read)) {
    if (isFolderRole(role) && typeof folder === 'string') held[role] = folder
  }

  return held
}

async function readCache(root: string): Promise<RoleFolders> {
  try {
    return parseCache(await readFile(join(root, ROLE_CACHE_FILE), 'utf8'))
  } catch {
    return {}
  }
}

export type RoleResolution = { roles: RoleFolders; walked: boolean }

/**
 * Where each role sits in this project, and whether finding out cost a walk.
 *
 * Two steps, so an ordinary open pays ten reads rather than a traversal: what the cache claims is
 * VERIFIED against the marker, and only a role that no longer answers sends the walk out. A
 * folder renamed in the Finder is therefore found — at the price of one walk, once.
 *
 * A role nothing carries is left OUT rather than pointed at its default: absent says "nowhere
 * yet", where a default would say "here", and the two must not read alike — one is written to.
 */
export async function resolveRoleFolders(root: string): Promise<RoleResolution> {
  const cached = await readCache(root)
  const held: RoleFolders = {}

  await Promise.all(
    FOLDER_ROLES.map(async role => {
      const folder = cached[role]
      if (folder !== undefined && (await carriesRole(root, folder, role))) held[role] = folder
    }),
  )

  if (FOLDER_ROLES.every(role => held[role] !== undefined)) return { roles: held, walked: false }

  return { roles: await byWalking(root, held), walked: true }
}

/** The roles the cache could not vouch for, looked up where they really are. */
async function byWalking(root: string, held: RoleFolders): Promise<RoleFolders> {
  // The walk the explorer already has, hidden entries and all — a marker IS a dotted file, so
  // one traversal carries every claim in the project. Unsorted, hence the fixed language.
  const reader = createFolderReader(
    () => root,
    () => 'en',
  )
  const markers = (await reader.walk(true)).filter(entry => nameOf(entry.path) === ROLE_MARKER)
  const found: RoleFolders = { ...held }

  await Promise.all(
    markers.map(async marker => {
      const folder = parentOf(marker.path)
      if (folder === null) return

      let claimed: string
      try {
        claimed = (await readFile(join(root, marker.path), 'utf8')).trim()
      } catch {
        // Gone between the walk and this read, or unreadable: a marker nobody can open claims
        // nothing, which is the same as there being none.
        return
      }
      if (!isFolderRole(claimed) || held[claimed] !== undefined) return

      const rival = found[claimed]
      found[claimed] = rival === undefined ? folder : preferredRoleFolder(rival, folder)
      if (rival !== undefined && rival !== found[claimed]) {
        log.info('project', `two folders claim the role ${claimed}; keeping ${found[claimed]}`)
      }
    }),
  )

  return found
}

export async function writeRoleCache(root: string, roles: RoleFolders): Promise<void> {
  try {
    // Its own folder rather than the one `ensureMachineFolders` lays down: this is written on a
    // project being opened, and a `.index/` sent to the trash must cost a walk, never a failure.
    await mkdir(join(root, INDEX_FOLDER), { recursive: true })
    await writeAtomic(join(root, ROLE_CACHE_FILE), JSON.stringify(roles, null, 2))
  } catch (error) {
    // The cache is what spares a walk, never what answers: losing it costs one traversal.
    log.warn('project', `writing the folder-role cache failed: ${String(error)}`)
  }
}

/**
 * The folder a role names, laid down with its marker if the project has none.
 *
 * Called by whoever is about to WRITE, which is the only moment a missing folder matters — a
 * project whose `Images/` was thrown away opens fine and only gets one back when something needs
 * filing. The marker goes on the folder even when the default path already exists but is bare,
 * so a project made before the roles gains them one shelf at a time rather than never.
 */
export async function ensureRoleFolder(
  root: string,
  roles: RoleFolders,
  role: FolderRole,
): Promise<string> {
  const known = roles[role]
  if (known !== undefined && (await exists(join(root, known)))) return known

  await markRoleFolder(root, DEFAULT_ROLE_PATHS[role], role)
  return DEFAULT_ROLE_PATHS[role]
}
