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
  /**
   * A 403 the plan caused, not the key — the API names it `ModelAccessRestrictedError`. Split
   * from `forbidden` because the two need opposite answers: one is a key to fix, the other a
   * subscription, and telling a paying user their key lacks permissions sends them nowhere.
   */
  | 'plan-restricted'
  | 'not-found'
  | 'rate-limited'
  | 'server'
  | 'network'
  | 'unexpected'

/** What a generation can fail on, beyond the API itself. */
export type JobFailure = ApiFailure | 'rejected' | 'storage' | 'incomplete-model'
