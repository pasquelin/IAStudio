import { ASSET_TYPES, type AssetType } from './asset'
import { typeOfWorkspace } from './assetKind'
import { kindForExtension, workspaceForKind } from './document'
import { extensionOf } from './fileName'

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
 * **No SOURCE extension reaches `texture` or `skybox`, and that is deliberate.** There is no such
 * thing as a texture file: there are PNGs, and a material document that gives some of them a part
 * to play — that document is an edit, and it is what carries those two domains. Guessing from a
 * suffix or a folder name would be right often and wrong silently: a normal map and an albedo
 * are both PNGs. A source takes those domains by being referenced, or by the user saying so; the
 * guess never gets a vote.
 */
const DOMAIN_BY_EXTENSION: Record<string, AssetType> = {
  '.png': 'image',
  // A layered picture is still a picture: it sits on the image shelf, and what a tile shows of
  // it is the flatten the container is required to carry.
  '.ora': 'image',
  '.jpg': 'image',
  '.jpeg': 'image',
  '.webp': 'image',
  '.avif': 'image',
  '.gif': 'image',
  '.svg': 'image',
  '.tif': 'image',
  '.tiff': 'image',
  '.heic': 'image',
  // Both are pictures until something says otherwise, high dynamic range or not — the sky
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
 * What a file is, from its name and nothing else.
 *
 * A document — `.gltf`, `.ora`, `.otio` — is an EDIT, and its domain is the one its editor works
 * in: a scene belongs beside the meshes, a picture beside the pictures. That link is not
 * spelled again here; it is read from the two tables that already carry it, so a kind that
 * changes space changes it in one place.
 *
 * **The case rule is asymmetric, and it is not an oversight.** `kindForExtension` is
 * case-sensitive on purpose — a `.SCENE` is not a document to the listing that walks the folder,
 * and answering otherwise here would show the user an editable document nothing can open. Source
 * extensions carry no such contract, so they are folded.
 */
export function natureOf(fileName: string): FileNature {
  const extension = extensionOf(fileName)

  const kind = kindForExtension(extension)
  if (kind) {
    const workspace = workspaceForKind(kind)
    return { domain: (workspace && typeOfWorkspace(workspace)) ?? 'other', role: 'edit' }
  }

  return { domain: DOMAIN_BY_EXTENSION[extension.toLowerCase()] ?? 'other', role: 'source' }
}

/**
 * Which of those the studio can actually SHOW, rather than merely name.
 *
 * Narrower than the domains above on purpose: `.heic`, `.tif`, `.exr` and `.hdr` are pictures
 * nothing here decodes, and `.glb` is the only mesh a loader here reads. Opening one of the
 * others would post an empty tab where handing it to the system still shows the file.
 */
const OPENABLE_EXTENSIONS: readonly string[] = [
  '.png',
  '.ora',
  '.jpg',
  '.jpeg',
  '.webp',
  '.avif',
  '.gif',
  '.svg',
  '.mp4',
  '.webm',
  '.mov',
  '.mkv',
  '.avi',
  '.m4v',
  '.wav',
  '.mp3',
  '.flac',
  '.ogg',
  '.m4a',
  '.aac',
  '.aiff',
  '.glb',
]

/**
 * Whether a double-click on this file belongs in the studio or with the system.
 *
 * A document always does — it is the studio's own. A source does when something here can draw
 * it; everything else, `.txt` and `.pdf` included, is the system's to open.
 *
 * **The blind spot, written rather than hidden**: a document is now held in the SAME file type as
 * an asset — `.ora`, `.gltf`, `.otio` — and this reads the name alone, so a plain glTF mesh
 * dropped in a project answers `edit` and is handed to the scene editor. Telling the two apart
 * needs the file's own content, which no caller of this has.
 */
export function opensInStudio(fileName: string): boolean {
  if (natureOf(fileName).role === 'edit') return true

  return OPENABLE_EXTENSIONS.includes(extensionOf(fileName).toLowerCase())
}

/**
 * Every domain a file can be filed under, for a facet list or a picker.
 *
 * Built from `ASSET_TYPES` rather than written out: a seventh domain would otherwise be a domain
 * the shelf knows and this list does not.
 */
export const FILE_DOMAINS: readonly FileDomain[] = [...ASSET_TYPES, 'other']
