import { readFile } from 'node:fs/promises'
import { join } from 'node:path'
import type { JobKind } from '@shared/domain/job'
import { isMissing, writeAtomic, writeQueue } from '@main/persistence'
import { parseStoredJobs } from './validation'

/**
 * What is kept of a job so that closing the studio does not lose it.
 *
 * Only what nothing else can tell us again: the remote id to poll, the account to poll it on,
 * the project its outputs belong in, and the two labels the jobs bar draws. The status and the
 * progress are deliberately absent — they are whatever the API says on the next poll, and a
 * stale copy of them would be a second truth.
 */
export type PersistedJob = {
  id: string
  remoteId: string
  kind: JobKind
  targetId: string
  label: string
  /**
   * The account the job was submitted on, as `accountFingerprint` names it. A job id asked
   * about under another key answers 404, and no retry repairs a 404.
   */
  accountId: string
  /** Where its outputs go. The collector writes into whichever project is open, not this one. */
  projectPath: string
  createdAt: string
}

export type JobStore = {
  /** What this project left running, minus anything too old to still be worth polling. */
  read: (projectPath: string) => Promise<PersistedJob[]>
  /**
   * Replaces the entries this session is responsible for — `handled` — with `jobs`. Everything
   * else in the file belongs to a project that has not been reopened, and stays untouched.
   */
  write: (jobs: readonly PersistedJob[], handled: readonly string[]) => Promise<void>
  /** Settles the writes in flight. For the two moments the process may not outlive them. */
  flush: () => Promise<void>
}

const FILE_NAME = 'jobs.json'

/**
 * Past this, a note is swept rather than resumed. Long enough for the longest job the API has —
 * a model training runs for hours — and short enough that a project abandoned mid-generation
 * does not leave its entries in the file for ever.
 */
export const JOB_NOTE_LIFETIME_MS = 7 * 24 * 60 * 60 * 1000

/**
 * Unfinished jobs, in the user's data folder rather than in a project.
 *
 * A job belongs to the account that paid for it, not to whatever project happened to be open —
 * and the project catalogue is a synchronous SQLite on its own thread, which a boot-time read
 * has no business waking.
 */
export function createJobStore(userDataPath: () => string, now: () => number = Date.now): JobStore {
  const fileOf = (): string => join(userDataPath(), FILE_NAME)

  const queue = writeQueue()

  /**
   * What is on disk, or `null` when the file is there and could not be read.
   *
   * The two are not the same answer, and reading them as one is how every other project's notes
   * get deleted: a write rebuilds the file from this, so a transient `EMFILE` or a scanner
   * holding the file for a moment would have the next job settling erase work nobody could see
   * was pending. Absent is `[]`; unreadable stops the write.
   */
  const held = async (): Promise<PersistedJob[] | null> => {
    let content: string
    try {
      content = await readFile(fileOf(), 'utf8')
    } catch (error) {
      // A first launch, or a session that ended with nothing running.
      if (isMissing(error)) return []
      return null
    }

    try {
      return parseStoredJobs(content)
    } catch {
      // Unparseable is not unreadable: the content is beyond recovery whatever we do, so
      // writing over it is the only way out, and refusing would wedge the file for good.
      return []
    }
  }

  const fresh = (job: PersistedJob): boolean =>
    now() - Date.parse(job.createdAt) < JOB_NOTE_LIFETIME_MS

  return {
    read: async projectPath =>
      (await held())?.filter(job => job.projectPath === projectPath && fresh(job)) ?? [],

    write: (jobs, handled) => {
      const run = async (): Promise<void> => {
        const stored = await held()
        // Refusing beats rewriting from a list we could not read: the entries of a project
        // nobody has reopened would be gone, and nothing would say so.
        if (stored === null) throw new Error('job notes could not be read')

        const others = stored.filter(job => !handled.includes(job.id) && fresh(job))
        await writeAtomic(fileOf(), JSON.stringify([...others, ...jobs]))
      }

      return queue.next(run)
    },

    flush: queue.settled,
  }
}
