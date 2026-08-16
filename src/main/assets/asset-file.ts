import { rename } from 'node:fs/promises'
import { dirname, extname, join } from 'node:path'
import type { Asset } from '@shared/domain/asset'
import { assetFileName } from '@shared/domain/asset-name'
import { foldForFileName, stemForSuffix } from '@shared/domain/file-name'
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
export const DUPLICATE_NAME = 'duplicate'

/**
 * The first path in `folder` nobody has taken — `Ruelle bleue.png`, then `Ruelle bleue 2.png`.
 *
 * For the names the studio engenders itself, where there is nobody to ask: a generation lands
 * under its prompt, and a job of four outputs lands four times under that one prompt. A name the
 * user TYPED is refused instead — suffixing it would hand them an asset called something they
 * did not write.
 */
export async function freeAssetPath(
  root: string,
  folder: string,
  name: string,
  extension: string,
): Promise<string> {
  const path = (candidate: string): string => `${folder}/${assetFileName(candidate, extension)}`
  const free = async (candidate: string): Promise<boolean> =>
    !(await exists(join(root, path(candidate))))

  if (await free(name)) return path(name)

  const stem = stemForSuffix(name)

  // No bound: the loop ends on the first free name, and there are only ever as many taken as
  // there are files in the folder.
  for (let n = 2; ; n += 1) {
    const candidate = `${stem} ${n}`
    if (await free(candidate)) return path(candidate)
  }
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
  const source = assetFilePath(root, asset.path)
  if (!source) return asset.path

  const folder = parentOf(asset.path)
  const wanted = assetFileName(name, extname(asset.path))
  const target = folder === null ? wanted : `${folder}/${wanted}`

  if (target === asset.path) return asset.path

  // A row whose file somebody deleted by hand still takes its new name: there is nothing to
  // move, and refusing would leave a name uncorrectable on the one row that most needs it.
  if (!(await exists(source))) return asset.path

  const destination = join(dirname(source), wanted)

  // Case alone is not a duplicate. APFS and NTFS hold ONE file for `Ruelle.png` and `ruelle.png`,
  // and that file is this asset's own — asking the disk would refuse the rename against itself.
  const collides =
    foldForFileName(target) !== foldForFileName(asset.path) && (await exists(destination))
  if (collides) throw new Error(DUPLICATE_NAME)

  await rename(source, destination)
  return target
}
