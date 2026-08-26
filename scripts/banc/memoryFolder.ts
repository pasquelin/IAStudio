import type { FolderReader, FolderWriter } from '@main/project/folder'
import {
  entriesByName,
  isHiddenEntry,
  isUnder,
  nameOf,
  parentOf,
  type FileKind,
  type FolderEntry,
} from '@shared/domain/folder'
import { DEFAULT_LANGUAGE } from '@shared/i18n/languages'
import { matchesWords, searchWords } from '@shared/text'

/**
 * 🛑 The DISK, and nothing else: the writers below are as naive as the real ones, doing what they
 * are told and refusing only what a race would refuse. A bench that decided here would be a
 * second studio, free to disagree with the first.
 */
export type MemoryFolder = FolderReader &
  FolderWriter & {
    paths: () => readonly string[]
    /** A file put there by something other than a gesture — what a generation lands as. */
    write: (path: string) => Promise<void>
    /** What the disk holds at this path, without listing anything around it. */
    kindOf: (path: string) => FileKind | null
  }

const entryOf = (path: string, kind: FileKind): FolderEntry => ({
  path,
  name: nameOf(path),
  kind,
})

export function createMemoryFolder(
  seed: readonly { path: string; kind: FileKind }[],
): MemoryFolder {
  const held = new Map(seed.map(one => [one.path, one.kind]))

  const under = (path: string): string[] =>
    [...held.keys()].filter(one => one === path || isUnder(one, path))

  const entries = (): FolderEntry[] => [...held].map(([path, kind]) => entryOf(path, kind))

  const shown = (all: FolderEntry[], hidden: boolean): FolderEntry[] =>
    all.filter(one => hidden || !isHiddenEntry(one.path)).sort(entriesByName(DEFAULT_LANGUAGE))

  const carry = (from: string, to: string, keepSource: boolean): boolean => {
    if (!held.has(from)) return false

    for (const path of under(from)) {
      const kind = held.get(path)
      if (kind === undefined) continue

      held.set(path === from ? to : path.replace(`${from}/`, `${to}/`), kind)
      if (!keepSource) held.delete(path)
    }

    return true
  }

  const folder: MemoryFolder = {
    list: (relative, hidden = false) =>
      Promise.resolve(
        shown(
          entries().filter(one => parentOf(one.path) === relative),
          hidden,
        ),
      ),

    search: (term, hidden = false) => {
      const words = searchWords(term)
      return Promise.resolve(
        shown(
          entries().filter(one => words.length > 0 && matchesWords(one.name, words)),
          hidden,
        ),
      )
    },

    walk: (hidden = false) => Promise.resolve(shown(entries(), hidden)),

    names: relative =>
      Promise.resolve(
        held.get(relative) === 'folder' || relative === ''
          ? entries()
              .filter(one => parentOf(one.path) === relative)
              .map(one => one.name)
          : null,
      ),

    move: (from, to) => Promise.resolve(carry(from, to, false)),
    copy: (from, to) => Promise.resolve(carry(from, to, true)),

    createFolder: relative => {
      if (held.has(relative)) return Promise.resolve(false)

      held.set(relative, 'folder')
      return Promise.resolve(true)
    },

    trash: relative => {
      if (!held.has(relative)) return Promise.resolve(false)

      for (const path of under(relative)) held.delete(path)
      return Promise.resolve(true)
    },

    paths: () => [...held.keys()],

    write: path => {
      held.set(path, 'file')
      return Promise.resolve()
    },

    kindOf: path => held.get(path) ?? null,
  }

  return folder
}
