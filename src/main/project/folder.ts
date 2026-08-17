import { watch, type FSWatcher } from 'node:fs'
import { cp, mkdir, readdir, rename } from 'node:fs/promises'
import { join } from 'node:path'
import { exists } from '@main/persistence'
import { kindForExtension } from '@shared/domain/document'
import { extensionOf } from '@shared/domain/file-name'
import { entriesByName, isHiddenEntry, type FolderEntry } from '@shared/domain/folder'
import { foldForSearch } from '@shared/text'

/**
 * How far a search walks. A project is someone's own folder and can hold a checkout of anything;
 * the studio's own layout is three levels deep, and a match twelve folders down is a match
 * nobody was looking for by the time the tree has drawn its ancestors.
 */
const MAX_SEARCH_DEPTH = 12

export type FolderReader = {
  /**
   * One level of the project folder. `''` is the project root.
   *
   * `hidden` shows what a leading dot hides — the studio's own bookkeeping, which the explorer
   * offers to reveal. Shown, never written to: `isStudioPrivate` refuses every gesture over them.
   * Left out, nothing under a dot comes back, which is what a reader sees by default.
   */
  list: (relative: string, hidden?: boolean) => Promise<FolderEntry[]>
  /**
   * Every entry of the WHOLE project folder whose name holds `term`, files and folders alike.
   *
   * A second source of nodes rather than a filter over the first: the explorer loads one folder
   * at a time, so it cannot filter what it has never read — a word matching a file nobody has
   * unfolded would answer nothing. The tree rebuilds the ancestors of what comes back.
   *
   * Folded on both sides (`foldForSearch`), so `foret` finds `Forêt`.
   */
  search: (term: string, hidden?: boolean) => Promise<FolderEntry[]>
  /**
   * Every FILE the project folder holds, at any depth — what the domain view reads.
   *
   * Folders are left out; a document written as a folder is not one for this purpose and is
   * answered as the item it is. Same depth bound and same refusal to walk into a document as
   * the search: the two are one walk.
   */
  walk: (hidden?: boolean) => Promise<FolderEntry[]>
  /**
   * Every name one level holds, hidden ones included and in no particular order — what a
   * planner needs to know which names are taken.
   *
   * Told apart from `list`, which is what a READER sees: a name under a dot is not shown and
   * still occupies its name, so planning against the shown list would hand `writeFile` a name
   * something already answers to. Answers nothing for a path that is not a folder, which is how
   * a destination that has gone is told apart from an empty one.
   */
  names: (relative: string) => Promise<readonly string[] | null>
}

/**
 * Reads the project folder for the explorer — one level per call, never the whole tree.
 *
 * `withFileTypes` is what makes it one syscall per entry instead of a `stat` each: a folder of
 * four thousand rushes is the ordinary case in `assets/vid`, and this runs in the main process.
 *
 * A symlink is reported as neither a folder nor a file by `withFileTypes`; it is listed as a
 * file, so a reader sees it exists rather than having it vanish. Following it is the system's
 * business, on the double-click.
 *
 * `languageOf` is injected beside `rootOf` rather than read off `windowLanguage()`, which is what
 * the first version did. Two reasons, and the second is the one that decided it: `services.ts` is
 * a composition root where nothing reaches for a singleton, and a global cannot be handed a value
 * by a unit test — the ordering cases below rode silently on `DEFAULT_LANGUAGE` and could not
 * express the language they depend on, while an unrelated suite's `beforeEach` was free to move it.
 */
export function createFolderReader(rootOf: () => string, languageOf: () => string): FolderReader {
  const level = async (relative: string, hidden = false): Promise<FolderEntry[]> => {
    const entries = await readdir(join(rootOf(), relative), { withFileTypes: true })

    return entries
      .filter(entry => hidden || !isHiddenEntry(entry.name))
      .map((entry): FolderEntry => {
        // NFC, and this is one of the two places the studio settles that question — the other is
        // `safeFileName`, where a name is made. A volume that stores decomposed hands back `Été`
        // as `E` plus an accent where the catalogue holds it composed, and every comparison of
        // the two answers no: the row the explorer would have joined to this file, the path a
        // rescan would have recognised, the asset an inspector would have found.
        const name = entry.name.normalize('NFC')
        return {
          path: relative === '' ? name : `${relative}/${name}`,
          name,
          kind: entry.isDirectory() ? 'folder' : 'file',
        }
      })
      .sort(entriesByName(languageOf()))
  }

  /**
   * Every entry the whole folder holds, `keep` deciding which of them are answered.
   *
   * One walk behind the two readers below: they differ in what they keep, never in how they
   * read. A folder that will not answer contributes nothing rather than failing the pass — it
   * may have gone between the listing that named it and this call.
   */
  const walkAll = async (
    hidden: boolean,
    keep: (entry: FolderEntry) => boolean,
  ): Promise<FolderEntry[]> => {
    const found: FolderEntry[] = []

    const walk = async (relative: string, depth: number): Promise<void> => {
      const entries = await level(relative, hidden).catch((): FolderEntry[] => [])
      const deeper: Promise<void>[] = []

      for (const entry of entries) {
        if (keep(entry)) found.push(entry)
        if (entry.kind !== 'folder' || depth >= MAX_SEARCH_DEPTH) continue
        // An image document IS a folder, and what it holds is the studio's own writing — a walk
        // that went into it would offer the parts instead of the document.
        if (kindForExtension(extensionOf(entry.name))) continue
        deeper.push(walk(entry.path, depth + 1))
      }

      // The folders of one level are read together, as `listing` reads the open ones: awaited
      // one at a time, the walk costs the SUM of the reads rather than the longest of them, in
      // the process that owns every window. A parent's own row is pushed before any of them, so
      // what a reader gets is still a folder before what it holds.
      await Promise.all(deeper)
    }

    await walk('', 0)
    return found
  }

  return {
    list: level,

    search: async (term, hidden = false) => {
      // Trimmed here as well as in the panel: a term of spaces alone would otherwise match every
      // name holding one, which is most of them.
      const wanted = foldForSearch(term.trim())
      if (wanted === '') return []

      return await walkAll(hidden, entry => foldForSearch(entry.name).includes(wanted))
    },

    walk: async (hidden = false) =>
      // Folders are left out, documents written as one excepted: the domain view answers what a
      // file IS, and a folder is not a domain.
      await walkAll(
        hidden,
        entry => entry.kind === 'file' || kindForExtension(extensionOf(entry.name)) !== null,
      ),

    names: async relative => await readdir(join(rootOf(), relative)).catch(() => null),
  }
}

/** Long enough to swallow the burst a copy or an export makes, short enough to feel live. */
const SETTLE_MS = 300

export type FolderWatch = { stop: () => void }

/**
 * `fs.watch`, injected. Not for the sake of a seam: the fallback below is the only code path a
 * platform without a recursive watch ever takes, and on the machine this is written on that
 * path cannot be reached at all — so without this it is written, shipped, and never once run.
 */
export type WatchOpener = (
  path: string,
  options: { recursive?: boolean },
  listener: () => void,
) => FSWatcher

/**
 * Tells the windows that the project folder changed, so the explorer follows the disk rather
 * than a button.
 *
 * **Debounced, and it has to be**: writing one asset makes several events — create, then one or
 * more writes — and an export writes a folder of them. What is announced is "something moved",
 * never what: the panel re-reads only the folders it has open, which is cheaper than carrying a
 * path through and far cheaper than being wrong about which folder to invalidate.
 *
 * **Best effort, deliberately.** A recursive watch is not offered on every platform, and a
 * project on a network volume can emit nothing at all. Falling back to a flat watch of the root
 * keeps the common case working; what covers the rest is the panel re-reading when the window
 * comes back to the front, which costs nothing when nothing changed.
 */
export function watchProjectFolder(
  root: string,
  announce: () => void,
  open: WatchOpener = watch,
): FolderWatch {
  let timer: NodeJS.Timeout | null = null
  let watcher: FSWatcher | null = null

  const settle = (): void => {
    if (timer) clearTimeout(timer)
    timer = setTimeout(() => {
      timer = null
      announce()
    }, SETTLE_MS)
  }

  try {
    watcher = open(root, { recursive: true }, settle)
  } catch {
    // No recursive watch here: a flat one still catches what lands in the project root, and the
    // window regaining focus is what catches the rest.
    try {
      watcher = open(root, {}, settle)
    } catch {
      // A folder that cannot be watched at all is not a folder that cannot be read: the panel
      // still lists it, it just will not follow it on its own.
      watcher = null
    }
  }

  // A watcher whose folder is deleted under it emits an error rather than throwing at creation.
  watcher?.on('error', () => watcher?.close())

  return {
    stop: () => {
      if (timer) clearTimeout(timer)
      timer = null
      watcher?.close()
      watcher = null
    },
  }
}

export type FolderWriter = {
  /** From one path to another, both relative. Answers whether it happened. */
  move: (from: string, to: string) => Promise<boolean>
  /** The same, by copy — a folder with everything under it. Answers whether it happened. */
  copy: (from: string, to: string) => Promise<boolean>
  /** One folder, at a path nothing holds yet. Answers whether it happened. */
  createFolder: (relative: string) => Promise<boolean>
  /** To the system's trash, never `unlink`. Answers whether the system took it. */
  trash: (relative: string) => Promise<boolean>
}

/**
 * The four gestures that write to the project folder. Primitives, and deliberately naive.
 *
 * **They refuse nothing on their own account**, which is the change this phase made: what may
 * be written is decided once, in `file-plan.ts`, against a reading of the folders taken before
 * anything moves. Two places deciding meant two answers free to disagree — and the panel would
 * grey a row the main process would have allowed, or the reverse.
 *
 * What is left here is the ONE refusal a plan cannot make, because it is a race and not a rule:
 * a name that appeared between the reading and the write. `rename` and `cp` overwrite without a
 * word on POSIX, and the file they would take is the user's own.
 *
 * All four answer `false` rather than throwing: a batch is a partial result by design, and one
 * member that will not move is a sentence to show rather than a reason to undo the rest.
 *
 * **Trash, never delete.** `shell.trashItem` puts the file where the user can get it back;
 * `unlink` is a gesture the studio does not take on someone else's folder at all.
 */
export function createFolderWriter(
  rootOf: () => string,
  toTrash: (file: string) => Promise<void>,
): FolderWriter {
  const onto = async (to: string, write: (target: string) => Promise<void>): Promise<boolean> => {
    const target = join(rootOf(), to)
    if (await exists(target)) return false

    try {
      await write(target)
      return true
    } catch {
      return false
    }
  }

  return {
    move: async (from, to) =>
      from === to || (await onto(to, target => rename(join(rootOf(), from), target))),

    // `recursive` because what is duplicated may be a folder, and `force: false` so a race
    // still refuses rather than overwriting — the check above is not the only guard.
    copy: async (from, to) =>
      await onto(to, target => cp(join(rootOf(), from), target, { recursive: true, force: false })),

    createFolder: async relative => await onto(relative, target => mkdir(target)),

    trash: async relative => {
      try {
        await toTrash(join(rootOf(), relative))
        return true
      } catch {
        return false
      }
    },
  }
}
