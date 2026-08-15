import { watch, type FSWatcher } from 'node:fs'
import { access, readdir, rename } from 'node:fs/promises'
import { basename, join } from 'node:path'
import {
  canMoveInto,
  entriesByName,
  isHiddenEntry,
  isStudioFolder,
  isStudioOwned,
  parentOf,
  type FolderEntry,
} from '@shared/domain/folder'

export type FolderReader = {
  /** One level of the project folder. `''` is the project root. */
  list: (relative: string) => Promise<FolderEntry[]>
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
  return {
    list: async relative => {
      const entries = await readdir(join(rootOf(), relative), { withFileTypes: true })

      return entries
        .filter(entry => !isHiddenEntry(entry.name))
        .map((entry): FolderEntry => ({
          path: relative === '' ? entry.name : `${relative}/${entry.name}`,
          name: entry.name,
          kind: entry.isDirectory() ? 'folder' : 'file',
        }))
        .sort(entriesByName(languageOf()))
    },
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

export type FolderEditor = {
  /** Renames in place, inside the folder it already sits in. Answers whether it happened. */
  rename: (relative: string, name: string) => Promise<boolean>
  /** Into ANOTHER folder, keeping its name. Answers whether it happened. */
  move: (relative: string, folder: string) => Promise<boolean>
  /** To the system's trash, never `unlink`. Answers whether the system took it. */
  trash: (relative: string) => Promise<boolean>
}

/**
 * The three gestures that write to the project folder from the explorer.
 *
 * All three answer `false` rather than throwing, and all three refuse the studio's own folders
 * — the catalogue stores every asset by a path under `assets/`, so moving one orphans rows
 * nobody can find again. The refusal lives here rather than in the panel: a window is not what
 * decides what may be written.
 *
 * **Rename and move are kept apart on purpose.** A menu row reading "Rename" must not be able
 * to displace a file, so `rename` builds its target in the folder the file already sits in and
 * cannot leave it. `move` keeps the name and changes the folder. One call taking both would be
 * one call two gestures could get wrong.
 *
 * **Trash, never delete.** `shell.trashItem` puts the file where the user can get it back;
 * `unlink` is a gesture the studio does not take on someone else's folder at all.
 */
export function createFolderEditor(
  rootOf: () => string,
  toTrash: (file: string) => Promise<void>,
): FolderEditor {
  const moveTo = async (relative: string, target: string): Promise<boolean> => {
    if (target === relative) return true

    const root = rootOf()
    // Checked rather than caught: `rename` overwrites an existing file without a word on
    // POSIX, and the file it would overwrite is the user's own.
    if (await exists(join(root, target))) return false

    try {
      await rename(join(root, relative), join(root, target))
      return true
    } catch {
      return false
    }
  }

  return {
    rename: async (relative, name) => {
      // Everything the studio owns, not just the folders themselves: a document is renamed
      // through `document:rename`, which moves its file AND rewrites its envelope, and an asset
      // is renamed in the catalogue. Renaming either as a plain file leaves the studio pointing
      // at a path that is no longer there — a row nobody can find, a tab that opens nothing.
      if (isStudioOwned(relative)) return false

      const parent = parentOf(relative)
      return moveTo(relative, parent === null ? name : `${parent}/${name}`)
    },

    move: async (relative, folder) => {
      if (!canMoveInto(relative, folder)) return false

      // A destination that is not a folder at all needs no check of its own: renaming into it
      // fails with ENOTDIR, and the catch is already the answer.
      return moveTo(relative, `${folder}/${basename(relative)}`)
    },

    trash: async relative => {
      if (isStudioFolder(relative)) return false

      try {
        await toTrash(join(rootOf(), relative))
        return true
      } catch {
        return false
      }
    },
  }
}

async function exists(file: string): Promise<boolean> {
  try {
    await access(file)
    return true
  } catch {
    return false
  }
}
