import type { AuthoredPrompt } from '@shared/domain/projectContext'

/**
 * What is kept of a job so that closing the studio does not lose it. The status and the progress
 * are deliberately absent — they are whatever the API says on the next poll, and a stale copy of
 * them would be a second truth.
 *
 * On its own rather than beside the store that writes it: the schema that parses these rows back
 * needs the type, and the store needs the schema, which is a cycle even spelt `import type`.
 */
export type PersistedJob = {
  id: string
  remoteId: string
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
  /**
   * What the person typed, when the project's context lengthened it. Written down although the
   * body is not: without it a job resumed after a restart names its output after the SENT prompt,
   * and every asset of a project comes back called the same thing.
   */
  authored?: AuthoredPrompt
}
