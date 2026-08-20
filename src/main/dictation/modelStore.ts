import { net } from 'electron'
import { createReadStream } from 'node:fs'
import { mkdir, open as openFile, rename, rm, stat } from 'node:fs/promises'
import { join } from 'node:path'
import type { DownloadHost, DownloadResponse } from './modelDownload'

/** Where the model lands when the user has not pointed somewhere else. */
export function defaultModelFolder(userData: string): string {
  return join(userData, 'models', 'stt')
}

/**
 * Reads a `fetch` body as chunks. `Response.body` is a web stream, which is async-iterable in
 * Node but not in the DOM types Electron's renderer half pulls in — so the reader is driven by
 * hand, once, here.
 */
async function* chunksOf(body: ReadableStream<Uint8Array> | null): AsyncIterable<Uint8Array> {
  if (!body) return

  const reader = body.getReader()
  try {
    for (;;) {
      const { done, value } = await reader.read()
      if (done) return
      if (value) yield value
    }
  } finally {
    reader.releaseLock()
  }
}

/**
 * The real world, for `modelDownload`.
 *
 * `net.fetch` rather than the global one, for the same reason the asset download uses it: it
 * goes through Electron's own network stack, so a proxy the operating system knows about is
 * honoured — and a 640 MB download is exactly what sits behind a corporate proxy.
 */
export function createDownloadHost(): DownloadHost {
  return {
    fetch: async (url, range): Promise<DownloadResponse> => {
      // A signed release URL expires, so the canonical address is resolved again on every
      // resume rather than kept from the run that stopped.
      const response = await net.fetch(url, {
        redirect: 'follow',
        headers: range > 0 ? { Range: `bytes=${range}-` } : {},
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

    exists: async path => {
      try {
        await stat(path)
        return true
      } catch {
        return false
      }
    },

    join,
  }
}

export async function ensureFolder(folder: string): Promise<void> {
  await mkdir(folder, { recursive: true })
}
