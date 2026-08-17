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
 * Sorted here even for `name`, which the disk answers in already — one listing at a time. That
 * is the catch: the whole-folder readers walk several folders AT ONCE, so what they hand back is
 * sorted within each level and interleaved between them, in whatever order the reads came home.
 * A view that trusted the disk drew the same project in a different order on every launch.
 *
 * Sorting the whole array is enough for a tree: it groups rows by parent and keeps the order it
 * was handed, so ordering the lot orders each parent's children.
 */
export function entriesSorted<T extends FolderEntry>(
  nodes: readonly T[],
  sort: string | null,
  language: string,
): readonly T[] {
  return [...nodes].sort(entriesByName(language, sort === 'nameDesc'))
}
