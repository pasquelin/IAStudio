/**
 * Where the application is in learning about, and fetching, a newer version of itself.
 *
 * A discriminated union rather than a bag of optional fields: `version` only means something
 * once one has been found, and `progress` only while bytes are moving.
 */
export type UpdateState =
  | { phase: 'idle' }
  | { phase: 'checking' }
  | { phase: 'available'; version: string }
  | { phase: 'downloading'; version: string; progress: number }
  | { phase: 'ready'; version: string }
  /**
   * A check that failed. Not an error to show loudly: the studio works perfectly well without
   * knowing whether it is current, and an offline user is not in trouble.
   */
  | { phase: 'failed'; reason: string }
