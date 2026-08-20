import type { FileKind } from './folder'

/**
 * What the DISK says about one entry of the project folder — and nothing the catalogue knows.
 *
 * Kept apart from `Asset` on purpose: a `.txt` has facts and will never have a row, so a window
 * built on the catalogue alone would have nothing at all to show for most of a project folder.
 */
export type FileFacts = {
  kind: FileKind
  /** A folder's own entry, not what it holds: nothing here walks a tree to total it. */
  bytes: number
  /** `null` where the filesystem records none — birthtime is not universal. */
  createdAt: string | null
  modifiedAt: string
}

/** URL fragment that tells the shared bundle it is rendering a file's information. */
export const FILE_INFO_ROUTE = 'file-info'

/**
 * The route one file's window loads, the path included — which is what makes it ONE window per
 * file: `openAuxiliaryWindow` keys its map on the route, so two paths are two windows and the
 * same path twice is the first one revealed.
 *
 * Encoded because a project path holds slashes and spaces, and both would otherwise be read as
 * structure by whoever parses the fragment back.
 */
export function fileInfoRoute(path: string): string {
  return `${FILE_INFO_ROUTE}/${encodeURIComponent(path)}`
}

export function isFileInfoRoute(hash: string): boolean {
  return hash.replace(/^#/, '').startsWith(`${FILE_INFO_ROUTE}/`)
}

/**
 * The path the fragment names, `null` for a fragment naming none.
 *
 * `decodeURIComponent` throws on a malformed escape, and the fragment is the one input this side
 * does not build itself — a window restored with a hand-edited URL must open empty, not white.
 */
export function fileInfoPathOf(hash: string): string | null {
  const encoded = hash.replace(/^#/, '').slice(`${FILE_INFO_ROUTE}/`.length)
  if (!isFileInfoRoute(hash) || encoded === '') return null

  try {
    return decodeURIComponent(encoded)
  } catch {
    return null
  }
}
