import { rename, rm, writeFile } from 'node:fs/promises'

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
 * mid-write cannot leave half a list where the whole one was. The staging name is fixed rather
 * than unique — writes are serialized, so only one copy can exist at a time, and a crash leaves
 * one the next write overwrites instead of an orphan per crash that nothing ever collects.
 */
export async function writeAtomic(file: string, content: string): Promise<void> {
  const staging = `${file}.staging`

  try {
    await writeFile(staging, content, 'utf8')
    await rename(staging, file)
  } catch (error) {
    // The tidy-up must not become the failure: what the caller has to hear is why the content
    // could not be written, not why the staging copy would not go away.
    await rm(staging, { force: true }).catch(() => {})
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
