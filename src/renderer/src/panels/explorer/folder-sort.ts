import { entriesByName, type FolderEntry } from '@shared/domain/folder'

/**
 * The orders the tree offers. Folders come first in both — that is what a file browser IS, and
 * an order that mixed them would be a list rather than a tree.
 */
export type FolderSort = 'name' | 'nameDesc'

export const FOLDER_SORTS: readonly FolderSort[] = ['name', 'nameDesc']

/**
 * The rows in the order asked for.
 *
 * `name` is what comes off the disk already — the main process sorts every listing it answers,
 * in the reader's own language — so only the other way round costs anything. Sorting the whole
 * array is enough: the tree groups rows by parent and keeps the order it was handed.
 */
export function entriesSorted<T extends FolderEntry>(
  nodes: readonly T[],
  sort: string | null,
  language: string,
): readonly T[] {
  return sort === 'nameDesc' ? [...nodes].sort(entriesByName(language, true)) : nodes
}
