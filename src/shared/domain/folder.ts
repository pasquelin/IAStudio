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
 * Whether anything on the way to `path` is hidden — which makes it READ-ONLY, not invisible.
 *
 * The two are told apart on purpose: the explorer offers to show these rows, and a row that can
 * be seen is a row a menu can be raised on. `.index/` is a catalogue the studio rebuilds and
 * `.project.json` is what says the folder is a project at all — renaming either from the tree
 * breaks the project for the sake of a name nobody reads.
 *
 * Every segment, not just the last: `.index/catalog.db` is the studio's own as surely as the
 * folder holding it.
 */
export function isHiddenPath(path: string): boolean {
  return path.split('/').some(isHiddenEntry)
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
export function entriesByName(
  language: string,
  /** Names the other way round. Folders stay first: reversing that is a different browser. */
  descending = false,
): (one: FolderEntry, other: FolderEntry) => number {
  return (one, other) => {
    if (one.kind !== other.kind) return one.kind === 'folder' ? -1 : 1
    const order = one.name.localeCompare(other.name, language)
    return descending ? -order : order
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
 * What an entry is CALLED — the last segment of its path.
 *
 * Beside `parentOf` rather than taken from `node:path`: `basename` reads a backslash as a
 * separator on Windows and not elsewhere, where these paths use `/` on every platform and are
 * refused if they hold anything else. Both sides ask it, and the renderer has no `node:path`.
 */
export function nameOf(path: string): string {
  return path.slice(path.lastIndexOf('/') + 1)
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
 * Whether the studio owns what sits at `path` — the folders above, and everything under them.
 *
 * What `isStudioFolder` says of the folders themselves, said of their contents, which is what
 * its own comment has always claimed and only this makes true: the catalogue stores every asset
 * by its path, so renaming `assets/img/asset_2604….png` behind its back leaves a row pointing
 * at nothing, and a document renamed as a file lands where its own channel is meant to take it.
 *
 * Read on both sides, as `canMoveInto` is: the panel greys the gesture out and the main process
 * refuses it regardless, a window not being what decides what gets written.
 */
export function isStudioOwned(path: string): boolean {
  return PROJECT_FOLDERS.some(folder => path === folder || path.startsWith(`${folder}/`))
}

/**
 * Whether the studio holds `path` for itself — the ONE spelling of that question.
 *
 * Two things make a path private, and they are not the same thing: the folders the catalogue
 * files assets under (`isStudioOwned`), and what a leading dot hides (`isHiddenPath`). Written
 * apart at each site, a third answer arriving tomorrow would have to be added to five of them,
 * and one could be forgotten without a test saying so.
 *
 * `contents` is the difference the trash draws: what a studio folder HOLDS may be thrown away —
 * the catalogue lets go of the rows underneath — where the folder itself is the layout the
 * project is read by. Nothing under a dot may go either way.
 */
export function isPrivatePath(path: string, contents: 'own' | 'shown' = 'own'): boolean {
  const studio = contents === 'own' ? isStudioOwned(path) : isStudioFolder(path)
  return studio || isHiddenPath(path)
}

/**
 * Why `path` may not go into `folder`, or `null` when it may.
 *
 * **The one spelling of the rule**, and it answers with a REASON rather than a boolean because
 * its two readers need different halves of the same answer: the panel greys the gesture out and
 * only needs to know THAT it is refused, while the main process reports what was refused and
 * why — 297 moved, 3 turned away, each with its sentence. Written twice, the two would be two
 * rules the day one of them is edited.
 *
 * The studio's own folders refuse on BOTH sides, and so does everything UNDER them: `assets/`
 * is still where a file's role is read from, so a picture dragged out of `assets/img` would
 * stop being a picture — the reconciliation pass is what lifts that, and it is not written yet.
 *
 * **The root receives**, which it did not: dropping on the blank below the tree means "to the
 * project folder", and a file that could enter a folder the user made but never leave it was a
 * browser missing one of its two ordinary gestures. No row of the catalogue stands for the root
 * either way — nothing under it is one of the studio's own paths.
 *
 * What it cannot answer is what only the disk knows: whether `folder` IS a folder, whether
 * either of them is still there, and whether the name is taken where it lands. The panel reads
 * the node's kind; `file-plan.ts` reads the folders and adds those refusals to this one.
 */
export function moveRefusal(path: string, folder: string): 'private' | 'into-itself' | null {
  if (isPrivatePath(path) || isPrivatePath(folder)) return 'private'

  // A folder dropped inside itself would take its own destination with it, and the rename that
  // carries it out would leave the whole subtree unreachable.
  if (folder === path || isUnder(folder, path)) return 'into-itself'

  return null
}

/** The same rule as the panel reads it: may this be dropped there, yes or no. */
export function canMoveInto(path: string, folder: string): boolean {
  return moveRefusal(path, folder) === null
}
