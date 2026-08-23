import { net } from 'electron'
import { createReadStream } from 'node:fs'
import { mkdir, open as openFile, readdir, rename, rm, rmdir, stat } from 'node:fs/promises'
import { join } from 'node:path'
import { chunksOf } from '@main/netStream'
import { exists } from '@main/persistence'
import type { DownloadHost, DownloadResponse } from './modelInstall'

/**
 * Where every model of the catalogue lands when the user has not pointed somewhere else.
 *
 * `models`, and no longer `models/stt`: the folder holds the whole catalogue — the recognition
 * model and every set of weights llama.cpp opens — and the name said otherwise. `migrateSttFolder`
 * carries what an earlier version left one level down.
 */
export function defaultModelFolder(userData: string): string {
  return join(userData, 'models')
}

/**
 * Moves what an earlier version wrote under `models/stt` up into `models`.
 *
 * File by file rather than by renaming the folder: the destination already exists, and a version
 * that ran both would have written into either. Anything it cannot move is left where it is — the
 * cost is one re-download of a model that is still on the disk, never a deletion.
 */
export async function migrateSttFolder(folder: string): Promise<void> {
  const previous = join(folder, 'stt')

  const found = await readdir(previous).catch(() => null)
  if (found === null) return

  for (const name of found) {
    // 🛑 Never over a name already taken above: `rename` overwrites, and the file up here is the
    // one a later version wrote. Left behind, it costs a re-download; overwritten, it is lost.
    const target = join(folder, name)
    if (!(await exists(target))) await rename(join(previous, name), target).catch(() => {})
  }

  // `rmdir` and not a recursive `rm`: a folder still holding something is one this could not
  // empty, and removing it anyway would delete exactly what was just protected.
  await rmdir(previous).catch(() => {})
}

/**
 * The real world, for `modelInstall`.
 *
 * `net.fetch` rather than the global one, for the same reason the asset download uses it: it
 * goes through Electron's own network stack, so a proxy the operating system knows about is
 * honoured — and a 640 MB download is exactly what sits behind a corporate proxy.
 */
export function createDownloadHost(): DownloadHost {
  return {
    fetch: async (url, range, signal): Promise<DownloadResponse> => {
      // A signed release URL expires, so the canonical address is resolved again on every
      // resume rather than kept from the run that stopped.
      const response = await net.fetch(url, {
        redirect: 'follow',
        headers: range > 0 ? { Range: `bytes=${range}-` } : {},
        signal,
      })

      return {
        ok: response.ok,
        status: response.status,
        partial: response.status === 206,
        body: chunksOf(response.body),
      }
    },

    sizeOf: async path => {
      try {
        return (await stat(path)).size
      } catch {
        // Absent is the normal case, and indistinguishable from unreadable for our purposes:
        // both mean there is nothing here to resume from.
        return 0
      }
    },

    open: async (path, resume) => {
      const handle = await openFile(path, resume ? 'a' : 'w')
      return {
        write: async chunk => {
          await handle.write(chunk)
        },
        close: () => handle.close(),
      }
    },

    readBack: path => createReadStream(path),

    remove: path => rm(path, { force: true }),

    rename,

    exists,

    join,
    ensureFolder,
  }
}

export async function ensureFolder(folder: string): Promise<void> {
  await mkdir(folder, { recursive: true })
}
