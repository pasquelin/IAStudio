import { createHash } from 'node:crypto'
import { mkdir, readdir, rm, stat, utimes } from 'node:fs/promises'
import { join } from 'node:path'
import { THUMBNAILS_FOLDER, THUMBNAILS_MAX_BYTES } from '@shared/domain/project'
import { assetFilePath } from '@main/assets/protocol'
import { boundedPool } from '@main/boundedPool'
import { exists, writeAtomic } from '@main/persistence'

export type ThumbnailCacheDeps = {
  projectPath: () => string | null
  /**
   * Renders a small picture of a file, or `null` for one the machine cannot preview. Injected
   * because `nativeImage` needs a live app, which no test has. The project-relative path comes
   * along so a renderer that fails can fall back on what the catalogue already holds.
   */
  render: (file: string, relative: string) => Promise<Uint8Array | null>
  concurrency: () => number
  /** Overridden by the tests alone, which would otherwise have to write two hundred megabytes. */
  maxBytes?: number
  /** When an entry was last useful. Injected so a test can order three reads within one tick. */
  now?: () => Date
}

export type ThumbnailCache = {
  /**
   * The PNG standing for the file at this project-relative path, or `null` when there is none to
   * draw — a folder, a file outside the project, a kind the machine cannot preview.
   */
  of: (relative: string) => Promise<string | null>
}

/**
 * Keyed by what the file IS rather than by its name alone: a picture overwritten in place keeps
 * its path, and a preview keyed on the path only would answer with the picture that is gone.
 */
function keyOf(relative: string, size: number, modified: number): string {
  return createHash('sha1').update(`${relative}:${size}:${modified}`).digest('hex')
}

/** Total bytes held, oldest read first — what an eviction walks. */
async function heldFiles(folder: string): Promise<{ file: string; bytes: number; at: number }[]> {
  const names = await readdir(folder).catch(() => [])

  const held = await Promise.all(
    names.map(async name => {
      const stats = await stat(join(folder, name)).catch(() => null)
      return stats?.isFile()
        ? { file: join(folder, name), bytes: stats.size, at: stats.mtimeMs }
        : null
    }),
  )

  return held.filter(one => one !== null).sort((one, other) => one.at - other.at)
}

/**
 * Previews of the files a project holds, rendered once and kept under `.index/`. Freshness is
 * an entry's own modification time, touched on every read — the only reason a read writes at
 * all, and what makes the eviction drop the unlooked-at rather than the oldest.
 */
export function createThumbnailCache(deps: ThumbnailCacheDeps): ThumbnailCache {
  const pool = boundedPool(deps.concurrency)
  const ceiling = deps.maxBytes ?? THUMBNAILS_MAX_BYTES
  const now = deps.now ?? ((): Date => new Date())
  /** Keys nothing could draw. Bounded by the project's files, and dropped with the process. */
  const undrawable = new Set<string>()

  /** Best effort: a read-only volume costs an entry its place in the queue, never the entry. */
  const touch = async (file: string): Promise<void> => {
    // Read ONCE: the two stamps are the same instant, and an eviction reads one of them.
    const at = now()
    await utimes(file, at, at).catch(() => {})
  }
  /** Written since the folder was last measured — measuring it is a `stat` per entry. */
  let sinceSweep = 0

  const evict = async (folder: string, written: number): Promise<void> => {
    sinceSweep += written
    if (sinceSweep < ceiling / 20) return
    sinceSweep = 0

    const held = await heldFiles(folder)
    let total = held.reduce((sum, one) => sum + one.bytes, 0)

    for (const one of held) {
      if (total <= ceiling) return
      await rm(one.file, { force: true })
      total -= one.bytes
    }
  }

  return {
    of: async relative => {
      const root = deps.projectPath()
      if (!root) return null

      const absolute = assetFilePath(root, relative)
      if (!absolute) return null

      const source = await stat(absolute).catch(() => null)
      if (!source?.isFile()) return null

      const folder = join(root, THUMBNAILS_FOLDER)
      const key = keyOf(relative, source.size, source.mtimeMs)
      const cached = join(folder, `${key}.png`)

      if (await exists(cached)) {
        await touch(cached)
        return cached
      }

      // A file nothing can draw is asked for again at every scroll, and answering costs a
      // QuickLook attempt each time. Remembered by KEY, so the answer expires with the file.
      if (undrawable.has(key)) return null

      const rendered = await pool.run(() => deps.render(absolute, relative))
      if (!rendered) {
        undrawable.add(key)
        return null
      }

      await mkdir(folder, { recursive: true })
      // Written aside then renamed: two windows asking for the same preview at once would
      // otherwise both write into the file the other is being served.
      await writeAtomic(cached, rendered, { staging: `${cached}.${process.pid}.tmp` })
      // Stamped like a read, so freshness is one notion: written IS read, for what was asked for.
      await touch(cached)

      await evict(folder, rendered.byteLength)
      return cached
    },
  }
}
