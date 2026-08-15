import { PROJECT_FOLDERS } from './project'

/**
 * The project folder as the explorer walks it — one level at a time, never the whole tree.
 *
 * A project's `assets/img` can hold thousands of files, and a reader who never opens it should
 * not pay for them. So the panel asks for the folder it is expanding, and nothing else.
 */
export type FolderEntry = {
  /**
   * Where the entry is, relative to the project root, with `/` between segments on every
   * platform. It is the tree's id as well as the path: two entries of a folder cannot share a
   * name, so the path is already unique, and one identifier is one thing to keep in step.
   */
  path: string
  name: string
  kind: 'folder' | 'file'
}

/** The root of the tree, which is the project folder itself. */
export const FOLDER_ROOT = ''

/**
 * What the explorer does not show. The rule is the platforms' own — a leading dot — and it
 * covers exactly the two the studio puts there: `.index/`, which it can rebuild, and
 * `.project.json`, which is its own bookkeeping. Hiding them by name rather than by a list is
 * what keeps a third one from having to be remembered.
 *
 * Everything else shows, including what the studio cannot open: that is the whole difference
 * between an explorer and a list of documents.
 */
export function isHiddenEntry(name: string): boolean {
  return name.startsWith('.')
}

/**
 * Folders first, then by name — the order every file browser uses, and the one that makes a
 * long folder readable without scrolling it twice.
 *
 * `localeCompare` rather than `<`: a project written in French files `Étude` between `Etat` and
 * `Fond` for a reader, and after `Zoo` for a code unit comparison.
 *
 * The language is taken rather than left out, which is why this is a factory and not the
 * comparator itself. A bare `localeCompare` answers in whatever locale the OS was installed in —
 * a language the studio may not even speak: measured, a Swedish desktop files `Ärger` past `Zoo`
 * and a Turkish one splits the two `i`s, neither of which French or English asks for.
 */
export function entriesByName(language: string): (one: FolderEntry, other: FolderEntry) => number {
  return (one, other) => {
    if (one.kind !== other.kind) return one.kind === 'folder' ? -1 : 1
    return one.name.localeCompare(other.name, language)
  }
}

/**
 * Whether `path` is inside `folder` — STRICTLY inside, so a folder is never under itself.
 *
 * That last word is the whole of it. A folder read again replaces what is under it, and a
 * folder counted as being under itself replaces its own row: opening `assets` emptied the tree
 * down to nothing, because the listing of `assets` never contains `assets`. Its row belongs to
 * its parent's listing, and only that listing may take it away.
 */
export function isUnder(path: string, folder: string): boolean {
  return folder === FOLDER_ROOT || path.startsWith(`${folder}/`)
}

/** The folder an entry sits in, which is its parent in the tree. `null` for a root entry. */
export function parentOf(path: string): string | null {
  const cut = path.lastIndexOf('/')
  return cut === -1 ? null : path.slice(0, cut)
}

/**
 * Whether the studio owns this folder rather than the user.
 *
 * `assets/`, `documents/` and what they contain are the project's own layout: the catalogue
 * stores every asset by a path under them, so renaming one orphans rows nobody can find again,
 * and trashing one takes the work with it. They are shown — hiding them would be lying about
 * what is on disk — and they refuse to be moved.
 *
 * Everything the user put there is theirs, and is renamed and trashed like any other file.
 */
export function isStudioFolder(path: string): boolean {
  return path === FOLDER_ROOT || PROJECT_FOLDERS.includes(path)
}

/**
 * Whether `path` may be dragged into `folder`.
 *
 * Both sides ask it, and that is the point of it living here: the panel refuses the gesture on
 * screen so nothing is dropped that will not move, and the main process refuses it again
 * because a window is not what decides what may be written. Two spellings of one rule would be
 * two rules the day one of them is edited.
 *
 * The studio's own folders refuse on BOTH sides — `assets/` cannot be moved, and nothing can be
 * moved into it, since the catalogue stores every asset by a path under it and a file that
 * lands there is a file no row knows about. The root refuses with them, and that is the shape
 * of `isStudioFolder` rather than a decision: no row stands for the root today, so no drop can
 * name it. **The day dropping on the blank below the tree means "to the root", this is the line
 * to revisit.**
 *
 * What it cannot answer is whether `folder` IS a folder — it only has paths. The panel reads
 * the node's kind, the main process asks the disk.
 */
export function canMoveInto(path: string, folder: string): boolean {
  if (isStudioFolder(path) || isStudioFolder(folder)) return false

  // A folder dropped inside itself would take its own destination with it, and the rename that
  // carries it out would leave the whole subtree unreachable.
  return folder !== path && !isUnder(folder, path)
}
