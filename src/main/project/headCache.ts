import { stat } from 'node:fs/promises'
import type { DocumentEnvelope, DocumentFile } from '@shared/domain/document'
import type { DocumentHead } from './documentBody'

/** What one file's head answered, and the clock the answer was taken against. */
export type CachedHead = {
  envelope: DocumentEnvelope
  /**
   * The body, when reading the head meant reading the whole file — and `null` whenever the
   * answer came out of the cache. Bodies are never kept: a project of fifty large montages
   * would hold a hundred megabytes of parsed timelines for a listing that shows their titles.
   */
  body: DocumentFile | null
  /**
   * What the file's clock said BEFORE its head was read.
   *
   * Taken first so the error leans the safe way: a file rewritten between the `stat` and the
   * read is remembered as older than it is, and the next save asks rather than overwriting.
   */
  time: number
}

export type HeadCache = {
  /** Throws whatever `stat` or the format's own reader throws — a caller tells absent from unreadable. */
  read: (file: string) => Promise<CachedHead>
  /** Drops one file's entry, for a caller that has just made it untrue. */
  forget: (file: string) => void
}

/**
 * How many heads are kept. The bench beside `documents.ts` lays 2 000 documents down, and a cap
 * under that would evict what one listing had just filled — so this is that shape with room
 * over it. An envelope is a title and three short fields, so the ceiling is a couple of
 * megabytes, not a budget worth tuning.
 */
const CAPACITY = 8_192

/**
 * The envelope of every document the studio has looked at, kept until its file changes.
 *
 * Written because the format is now the document: an `.otio` carries no head of ours, so listing
 * a project parses every montage in it whole — 17 ms each at 5 000 clips, on the thread that owns
 * every window. `documents.bench.ts` measured 143 ms for 2 000 enveloped documents against 45 ms
 * when none of them is opened at all; the montages are what makes that gap worth a map.
 *
 * **The blind spot, in clear**: freshness is `mtimeMs` and size, so a file rewritten within the
 * same millisecond AT THE SAME SIZE is served from the cache. The studio's own writers call
 * `forget`, which leaves the window open only to another application — and the stale check that
 * defends a save carries exactly the same one, `mtimeMs` being what a filesystem reports.
 *
 * Keyed by ABSOLUTE path, never by the project-relative one every other boundary uses: this
 * reader is built once for the life of the process and follows whichever project is open, and
 * two projects each holding `documents/Niveau.gltf` would otherwise answer for each other.
 */
export function createHeadCache(readHead: (file: string) => Promise<DocumentHead>): HeadCache {
  /** Insertion-ordered, and re-inserted on a hit: what falls out first is what nobody reads. */
  const entries = new Map<string, { envelope: DocumentEnvelope; time: number; size: number }>()

  return {
    read: async file => {
      const stats = await stat(file)
      const held = entries.get(file)

      if (held && held.time === stats.mtimeMs && held.size === stats.size) {
        entries.delete(file)
        entries.set(file, held)
        return { envelope: held.envelope, body: null, time: stats.mtimeMs }
      }

      const { content, ...envelope } = await readHead(file)
      entries.set(file, { envelope, time: stats.mtimeMs, size: stats.size })

      const oldest = entries.keys().next()
      if (entries.size > CAPACITY && !oldest.done) entries.delete(oldest.value)

      return {
        envelope,
        body: content === undefined ? null : { ...envelope, content },
        time: stats.mtimeMs,
      }
    },

    forget: file => {
      entries.delete(file)
    },
  }
}
