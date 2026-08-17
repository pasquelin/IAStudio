import { mkdir, readdir, rename } from 'node:fs/promises'
import { join } from 'node:path'
import type { Asset } from '@shared/domain/asset'
import {
  assetFileName,
  FALLBACK_ASSET_NAME,
  type AssetNameFailure,
} from '@shared/domain/asset-name'
import {
  extensionOf,
  foldForFileName,
  isSameFileName,
  safeFileName,
  stemForSuffix,
} from '@shared/domain/file-name'
import { parentOf } from '@shared/domain/folder'
import { exists } from '@main/persistence'
import { assetFilePath } from './protocol'

/**
 * Where an asset's bytes live, now that a row's name is also its file's.
 *
 * Free names are asked of the DISK rather than of the catalogue, and that is the whole reason
 * this is here rather than in `shared/`: a project folder is the user's, and it holds files no
 * row has ever heard of — one dropped in by hand, one left by a crash between the write and the
 * insert. A name checked free against the catalogue alone would be handed to `writeFile`, which
 * overwrites without a word.
 */

/** What a refused rename says. Recognised on the other side, where the field has closed. */
export const DUPLICATE_NAME: AssetNameFailure = 'duplicate'

/**
 * The first name in `folder` nobody has taken — `Ruelle bleue`, then `Ruelle bleue 2`.
 *
 * For the names the studio engenders itself, where there is nobody to ask: a generation lands
 * under its prompt, and a job of four outputs lands four times under that one prompt. A name the
 * user TYPED is refused instead — suffixing it would hand them an asset called something they
 * did not write.
 *
 * **One `stat`, then one `readdir`.** The nominal case is a name nobody holds, and it costs a
 * single check. Only a collision opens the folder, and then the candidates are tried in memory:
 * running the same prompt K times used to cost K sequential `stat`s on the K-th run — one folder
 * takes every picture an import lands, and an unnumbered prompt is the ordinary case, so that
 * grew without a bound anybody would notice.
 */
async function freeAssetName(
  root: string,
  folder: string,
  name: string,
  extension: string,
): Promise<string> {
  if (!(await exists(join(root, folder, assetFileName(name, extension))))) return name

  // Folded, because `exists` above answered for a case-insensitive volume: APFS and NTFS hold
  // one file for `Ruelle.png` and `ruelle.png`, and a raw Set would call the second one free.
  const taken = new Set(
    (await readdir(join(root, folder)).catch(() => [])).map(entry => foldForFileName(entry)),
  )
  const free = (candidate: string): boolean =>
    !taken.has(foldForFileName(assetFileName(candidate, extension)))

  const stem = stemForSuffix(name)

  // No bound: the loop ends on the first free name, and there are only ever as many taken as
  // there are files in the folder.
  for (let n = 2; ; n += 1) {
    const candidate = `${stem} ${n}`
    if (free(candidate)) return candidate
  }
}

/**
 * The same answer as a path, which is what an import needs to write.
 *
 * The folder is CREATED rather than required. `DEFAULT_ASSET_FOLDERS` is a default and no longer
 * a layout: a user who threw `Images/` away did nothing wrong, and the two answers that were
 * available without this — failing the import, or emptying it into the project root — are both
 * worse than putting the folder back.
 */
export async function freeAssetPath(
  root: string,
  folder: string,
  name: string,
  extension: string,
): Promise<string> {
  await mkdir(join(root, folder), { recursive: true })
  const free = await freeAssetName(root, folder, name, extension)
  return `${folder}/${assetFileName(free, extension)}`
}

/**
 * Moves an asset's file so that it is called after its new name, and answers where it now is.
 *
 * The extension and the folder are kept: a rename is neither a conversion nor a move, and a
 * texture's channel is read off the folder it sits in.
 *
 * Answers `undefined` for an asset that has no file of ours — one linked where the user left it,
 * one that lives in the library alone. Writing into a folder the user merely pointed at is a
 * gesture the studio does not take, so those keep their name in the catalogue and nowhere else.
 *
 * Throws `DUPLICATE_NAME` rather than overwriting: the file it would replace is another asset's,
 * and `rename` takes it without a word on POSIX.
 */
export async function moveAssetFile(
  root: string,
  asset: Asset,
  name: string,
): Promise<string | undefined> {
  if (!asset.path) return undefined

  // A stored path is user-editable territory — the same containment the scheme applies before
  // serving one. A row pointing outside the project is not a row whose file we move.
  if (!assetFilePath(root, asset.path)) return asset.path

  const folder = parentOf(asset.path)
  const wanted = assetFileName(name, extensionOf(asset.path))
  const target = folder === null ? wanted : `${folder}/${wanted}`

  if (target === asset.path) return asset.path

  // A row whose file somebody deleted by hand still takes its new name: there is nothing to
  // move, and refusing would leave a name uncorrectable on the one row that most needs it.
  if (!(await exists(join(root, asset.path)))) return asset.path

  // Case alone is not a duplicate — one file, this asset's own, changing how it is spelled.
  const collides = !isSameFileName(target, asset.path) && (await exists(join(root, target)))
  if (collides) throw new Error(DUPLICATE_NAME)

  await rename(join(root, asset.path), join(root, target))
  return target
}

/**
 * The same move, for a name the STUDIO wrote rather than one a user typed — a caption.
 *
 * Suffixed until free instead of refused, and cleaned instead of rejected, for the reason
 * `freeAssetPath` is: a sentence a model produced has nobody to hand back a refusal to. What
 * comes back is the name it SETTLED on, so the row can carry exactly what the folder does —
 * writing the wanted name beside a file called something else is the state all of this ends.
 *
 * `undefined` when there is no file of ours to move, as above.
 */
export async function moveAssetFileToFree(
  root: string,
  asset: Asset,
  name: string,
): Promise<{ name: string; path: string } | undefined> {
  if (!asset.path || !assetFilePath(root, asset.path)) return undefined

  const folder = parentOf(asset.path)
  if (folder === null) return undefined

  const free = await freeAssetName(root, folder, name, extensionOf(asset.path))
  const moved = await moveAssetFile(root, asset, free)

  // Cleaned rather than `free` itself: `safeFileName` drops what a file system will not hold,
  // and the row must say what the disk says rather than what was asked for. NOT `stemOf(moved)`
  // — a name may legitimately hold a dot, and `Ruelle v1.2.png` would come back as `Ruelle v1`.
  return moved ? { name: safeFileName(free, FALLBACK_ASSET_NAME), path: moved } : undefined
}
