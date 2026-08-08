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
   * A check that failed. It carries no reason: the studio works perfectly well without knowing
   * whether it is current, so `idle`, `checking` and `failed` all render as nothing — and the
   * message would name a local cache path or a feed URL for no one to read. It is logged on the
   * side that produced it instead.
   */
  | { phase: 'failed' }
