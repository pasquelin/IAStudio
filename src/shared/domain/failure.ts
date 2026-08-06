/**
 * Closed unions rather than free strings.
 *
 * An SDK error message embeds the request that produced it, so it carries the `Authorization`
 * header, so it carries the API key. The main process reduces every failure to a code; the
 * renderer turns the code into text. No message ever crosses the boundary — see spec § 3.7.
 */
export type ApiFailure =
  | 'missing'
  | 'invalid-credentials'
  | 'forbidden'
  | 'not-found'
  | 'rate-limited'
  | 'server'
  | 'network'
  | 'unexpected'

/** What a generation can fail on, beyond the API itself. */
export type JobFailure = ApiFailure | 'rejected' | 'storage'
