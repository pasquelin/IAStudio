import type { Asset } from '@shared/domain/asset'
import type { DocumentDescriptor } from '@shared/domain/document'
import { natureOf, type FileDomain, type FileRole } from '@shared/domain/file-role'
import { nameOf } from '@shared/domain/folder'

/**
 * One thing in the project folder, as every panel of the studio reads it.
 *
 * Three surfaces name the same file in three shapes today — the explorer holds a `FolderEntry`,
 * the shelf an `Asset`, the tabs a `DocumentDescriptor` — and each of them was working out what
 * a file IS on its own. This is the one answer, and the two adapters below are the only places
 * that compose it.
 *
 * It stands for a FILE, never a folder: the domain view lists what a file is, and a folder is
 * not a domain. The explorer's tree keeps its own nodes, which carry the kind it needs.
 */
export type ProjectItem = {
  /** Relative to the project folder, `/` on every platform — how the studio names a file. */
  path: string
  /** What is drawn: the document's title where there is one, else the file name. */
  name: string
  domain: FileDomain
  role: FileRole
  /**
   * The catalogue row behind it, or nothing.
   *
   * It is what makes the domain CORRECTABLE: the name can only guess — a normal map and an
   * albedo are both PNGs — and a row is the only thing that remembers an answer.
   */
  assetId: string | null
  /** The document the studio opens it as, when it is one. */
  document: DocumentDescriptor | null
  bytes: number | null
}

/** What the catalogue and the tabs may already know about a path the folder just answered. */
export type ItemContext = { asset?: Asset | null; document?: DocumentDescriptor | null }

/**
 * From a path the FOLDER named — the explorer's side.
 *
 * The catalogue answers before the extension does, and that is the whole of « corrected by
 * hand »: `natureOf` guesses from the name, a row remembers what was said.
 */
export function itemOfPath(path: string, { asset, document }: ItemContext = {}): ProjectItem {
  const nature = natureOf(nameOf(path))

  return {
    path,
    name: document?.title ?? nameOf(path),
    domain: asset?.type ?? nature.domain,
    role: nature.role,
    assetId: asset?.id ?? null,
    document: document ?? null,
    bytes: asset?.bytes ?? null,
  }
}

/**
 * From a row the CATALOGUE named — the shelf's side.
 *
 * A row with no path is one the project does not hold: a linked media, or an asset that lives in
 * the library alone. It is not an item of this project folder, and answers nothing.
 */
export function itemOfAsset(
  asset: Asset,
  document?: DocumentDescriptor | null,
): ProjectItem | null {
  if (!asset.path) return null
  return itemOfPath(asset.path, { asset, document })
}
