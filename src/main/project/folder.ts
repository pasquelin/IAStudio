import { watch, type FSWatcher } from 'node:fs'
import { readdir } from 'node:fs/promises'
import { join } from 'node:path'
import { compareEntries, isHiddenEntry, type FolderEntry } from '@shared/domain/folder'

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
 */
export function createFolderReader(rootOf: () => string): FolderReader {
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
        .sort(compareEntries)
    },
  }
}

/** Long enough to swallow the burst a copy or an export makes, short enough to feel live. */
const SETTLE_MS = 300

export type FolderWatch = { stop: () => void }

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
export function watchProjectFolder(root: string, announce: () => void): FolderWatch {
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
    watcher = watch(root, { recursive: true }, settle)
  } catch {
    // No recursive watch here: a flat one still catches what lands in the project root, and the
    // window regaining focus is what catches the rest.
    try {
      watcher = watch(root, settle)
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
