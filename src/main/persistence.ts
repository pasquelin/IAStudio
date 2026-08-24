import { access, open, rename, rm, writeFile } from 'node:fs/promises'

/**
 * How the studio writes the small files it keeps for the user — the job notes, the pinned
 * recipes, the saved styles.
 *
 * Written once at the third copy. The three stores had the same twenty lines with the same three
 * comments, and each one said so: "written the way the job notes are, and for the same reason".
 * Only the mechanics are shared — what each store reads, parses and merges stays its own, because
 * that is where they genuinely differ.
 */

/**
 * Content into place, or the previous content untouched. Never a truncated file.
 *
 * Through a staging copy renamed over the target: a rename within a folder is atomic, so a crash
 * mid-write cannot leave half a list where the whole one was.
 *
 * The staging name defaults to a fixed one, which is right when writes are serialized: only one
 * copy can exist at a time, and a crash leaves one the next write overwrites instead of an orphan
 * per crash that nothing ever collects. A caller whose writes are *not* serialized — several
 * windows saving into the same project folder — passes a name unique to the call instead.
 *
 * `mode` is set on the STAGING copy, before the rename, which is the only order that never
 * exposes the content: a file created at the default mode and narrowed afterwards is readable
 * for the width of that gap. It exists for the one file here that is a secret — the MCP token —
 * and defaults to what every other caller was already getting.
 */
export async function writeAtomic(
  file: string,
  content: string | Uint8Array,
  { staging = `${file}.staging`, mode }: { staging?: string; mode?: number } = {},
): Promise<void> {
  try {
    // The encoding is for TEXT alone: naming one for bytes would have `fs` re-encode them.
    await writeFile(staging, content, {
      ...(typeof content === 'string' ? { encoding: 'utf8' } : {}),
      ...(mode === undefined ? {} : { mode }),
    })
    await rename(staging, file)
  } catch (error) {
    // The tidy-up must not become the failure: what the caller has to hear is why the content
    // could not be written, not why the staging copy would not go away.
    try {
      await rm(staging, { force: true })
    } catch {
      // The tidy-up must not become the failure: the caller hears the write, not this.
    }

    throw error
  }
}

export type WriteQueue = {
  /** Runs after whichever write is already in flight, and answers to whoever queued it. */
  next: <T>(run: () => Promise<T>) => Promise<T>
  /** Settles what is in flight. For the moments the process may not outlive them. */
  settled: () => Promise<void>
}

/** One write at a time, so two racing cannot have the older one land last. */
export function writeQueue(): WriteQueue {
  let pending: Promise<unknown> = Promise.resolve()

  return {
    next: run => {
      const answer = pending.then(run)
      // Settled either way on the chain only: the caller still sees the rejection through
      // `answer`, and one failed write must not wedge the file for the rest of the session.
      pending = answer.catch(() => {})
      return answer
    },
    settled: async () => {
      await pending
    },
  }
}

/** Node reports a missing path this way, and it is the one failure that is not an error. */
export const isMissing = (error: unknown): boolean =>
  error instanceof Error && 'code' in error && error.code === 'ENOENT'

/**
 * Whether a path is there at all. Anything that is not a plain absence — a permission that
 * refuses, a volume that unmounted — answers `false` too: what asks this is deciding whether to
 * go and look, and it has to look either way.
 */
export const exists = (path: string): Promise<boolean> =>
  access(path).then(
    () => true,
    () => false,
  )

/** The head of a file and no more of it — what keeps a listing from reading a project whole. */
export async function firstBytes(file: string, limit: number): Promise<Buffer> {
  const handle = await open(file, 'r')
  try {
    // `allocUnsafe`: every byte handed back is one `read` wrote, and zeroing the rest per document
    // is work a listing pays for nothing.
    const buffer = Buffer.allocUnsafe(limit)
    const { bytesRead } = await handle.read(buffer, 0, limit, 0)
    return buffer.subarray(0, bytesRead)
  } finally {
    await handle.close()
  }
}
