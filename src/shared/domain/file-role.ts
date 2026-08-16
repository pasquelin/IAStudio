import { ASSET_TYPES, type AssetType } from './asset'
import { workspaceOfType } from './asset-kind'
import { kindForExtension, workspaceForKind } from './document'
import { extensionOf } from './file-name'
import type { WorkspaceId } from './workspace'

/**
 * Which of the studio's six domains a file belongs to, plus the answer for one it does not.
 *
 * `other` is not a failure to classify. A project folder is the user's own, and a `.pdf` of
 * storyboard notes sitting beside the rushes is a file the explorer shows and the studio leaves
 * alone — there is no domain to file it under, and inventing one would be worse than saying so.
 */
export type FileDomain = AssetType | 'other'

/** Bytes to look at, or a state of editing over them. */
export type FileRole = 'source' | 'edit'

export type FileNature = { domain: FileDomain; role: FileRole }

/**
 * What a file IS, by its name alone.
 *
 * The one table that answers this, and the reason it exists: until now the FOLDER answered. A
 * `.png` under `assets/tex` was a texture channel and the same file under `assets/img` was a
 * picture, so a project could not be arranged any other way without the studio losing track of
 * what it held. With the tree open, nothing about a path can say what a file is any more.
 *
 * **`texture` and `skybox` are never reached from an extension, and that is deliberate.** There
 * is no such thing as a texture file: there are PNGs, and a `.tex` document that gives some of
 * them a part to play. Guessing from a suffix or a folder name would be right often and wrong
 * silently — a normal map and an albedo are both PNGs. A file takes those domains by being
 * referenced, or by the user saying so; the guess never gets a vote.
 */
const DOMAIN_BY_EXTENSION: Record<string, AssetType> = {
  '.png': 'image',
  '.jpg': 'image',
  '.jpeg': 'image',
  '.webp': 'image',
  '.avif': 'image',
  '.gif': 'image',
  '.svg': 'image',
  '.tif': 'image',
  '.tiff': 'image',
  '.heic': 'image',
  // Both are pictures until something says otherwise, high dynamic range or not — the `.sky`
  // document is what turns one into an environment.
  '.exr': 'image',
  '.hdr': 'image',
  '.mp4': 'video',
  '.webm': 'video',
  '.mov': 'video',
  '.mkv': 'video',
  '.avi': 'video',
  '.m4v': 'video',
  '.wav': 'audio',
  '.mp3': 'audio',
  '.flac': 'audio',
  '.ogg': 'audio',
  '.m4a': 'audio',
  '.aac': 'audio',
  '.aiff': 'audio',
  '.glb': 'mesh',
  '.gltf': 'mesh',
  '.obj': 'mesh',
  '.fbx': 'mesh',
  '.stl': 'mesh',
  '.ply': 'mesh',
  '.usdz': 'mesh',
}

/**
 * The domain a workspace stands for — `workspaceOfType` read the other way.
 *
 * Searched rather than tabulated, exactly as `workspaceForKind` is and for its reason: a second
 * table is a second thing to keep in step, and six entries do not earn one.
 */
function typeOfWorkspace(workspace: WorkspaceId): AssetType | null {
  return ASSET_TYPES.find(type => workspaceOfType(type) === workspace) ?? null
}

/**
 * What a file is, from its name and nothing else.
 *
 * A document — `.scene`, `.img`, `.seq` — is an EDIT, and its domain is the one its editor works
 * in: a `.scene` belongs beside the meshes, a `.img` beside the pictures. That link is not
 * spelled again here; it is read from the two tables that already carry it, so a kind that
 * changes space changes it in one place.
 */
export function natureOf(fileName: string): FileNature {
  const extension = extensionOf(fileName).toLowerCase()

  const kind = kindForExtension(extension)
  if (kind) {
    const workspace = workspaceForKind(kind)
    const domain = workspace === null ? null : typeOfWorkspace(workspace)
    return { domain: domain ?? 'other', role: 'edit' }
  }

  return { domain: DOMAIN_BY_EXTENSION[extension] ?? 'other', role: 'source' }
}

/**
 * Every domain a file can be filed under, for a facet list or a picker.
 *
 * Built from `ASSET_TYPES` rather than written out: a seventh domain would otherwise be a domain
 * the shelf knows and this list does not.
 */
export const FILE_DOMAINS: readonly FileDomain[] = [...ASSET_TYPES, 'other']
