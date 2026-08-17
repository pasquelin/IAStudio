import { createHash } from 'node:crypto'
import { mkdir, readdir, rename, rm, stat, utimes, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { THUMBNAILS_FOLDER, THUMBNAILS_MAX_BYTES } from '@shared/domain/project'
import { assetFilePath } from '@main/assets/protocol'
import { boundedPool } from '@main/boundedPool'

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
 * Previews of the files a project holds, rendered once and kept under `.index/`.
 *
 * The freshness of an entry is its own modification time, touched on every read — so the
 * eviction below drops what nobody has looked at rather than what was made first. It is the
 * only reason a read writes anything at all.
 */
export function createThumbnailCache(deps: ThumbnailCacheDeps): ThumbnailCache {
  const pool = boundedPool(deps.concurrency)
  const ceiling = deps.maxBytes ?? THUMBNAILS_MAX_BYTES
  const now = deps.now ?? ((): Date => new Date())

  /** Best effort: a read-only volume costs an entry its place in the queue, never the entry. */
  const touch = async (file: string): Promise<void> => {
    await utimes(file, now(), now()).catch(() => {})
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
      const cached = join(folder, `${keyOf(relative, source.size, source.mtimeMs)}.png`)

      if (await stat(cached).catch(() => null)) {
        await touch(cached)
        return cached
      }

      const rendered = await pool.run(() => deps.render(absolute, relative))
      if (!rendered) return null

      await mkdir(folder, { recursive: true })
      // Written aside then renamed: two windows asking for the same preview at once would
      // otherwise both write into the file the other is being served.
      const staging = `${cached}.${process.pid}.tmp`
      await writeFile(staging, rendered)
      await rename(staging, cached)
      // Stamped like a read, so freshness is one notion: written IS read, for what was asked for.
      await touch(cached)

      await evict(folder, rendered.byteLength)
      return cached
    },
  }
}
