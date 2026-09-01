/**
 * What a stored key has LEFT to spend, which is the opposite reading of `usage.ts` and one only
 * two clouds answer. `READ` in `main/provider/credits.ts` is the list; a key from any other cloud
 * is ABSENT from a reading rather than carrying a zero.
 */

/**
 * The unit a cloud counts in when it does not count in MONEY — Tripo sells credits, and quotes
 * a balance in them with no currency anywhere in the answer.
 *
 * Named rather than left as a three-letter code: `Intl.NumberFormat` throws `RangeError` on a
 * currency it does not know, in the title bar's own render, so a screen has to tell the two
 * apart before it formats either.
 */
export const CREDIT_UNIT = 'credits'

/** An amount in the currency its cloud quoted, or in `CREDIT_UNIT`. Never converted. */
export type Money = {
  readonly amount: number
  readonly currency: string
}

/** `left` is a LIST: DeepSeek quotes one figure per currency held on the same key. */
export type CreditBalance =
  | { readonly state: 'known'; readonly left: readonly Money[] }
  /** The cloud publishes a balance and the call for it did not come back. */
  | { readonly state: 'unreadable' }

/** Account id to what that key has left. An account absent from it is one nothing can be said of. */
export type CreditBalances = Readonly<Record<string, CreditBalance>>
