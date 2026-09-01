import type { ActionName } from '@shared/domain/assistant'
import { stableKey } from '@shared/hash'
import { newId } from '@/helpers/ids'
import { MOST_CALLS } from './batch'

/**
 * The yes an MCP client carries back, for a question no screen here can hold.
 *
 * 🛑 It proves the caller was TOLD, never that a person agreed: only the client can carry a
 * question to whoever is there. Single-use and bound to the input, so no second call slips
 * through.
 *
 * 🛑 The second blind spot, written rather than hidden: the store is a module of the WINDOW, so a
 * token dies with the window that minted it — another window in front, or a reload, and the call
 * comes back to a fresh `needsConsent` with a new token, in a loop nothing reports as an error.
 * It lives here because `formChanged` compares a form only a window can read.
 */

/** A yes is worth what it was told, and a form read five minutes ago is no longer that. */
const LIFETIME_MS = 5 * 60_000

/**
 * Two full lots in flight, derived rather than guessed: at 64 a second refused lot evicted the
 * first one's tokens, and the client looped on `needsConsent` with nothing saying why.
 */
const MOST_PENDING = MOST_CALLS * 2

/** What the generation panel was showing when the token was minted — see `formChanged`. */
export type QuotedBody = { modelId: string; values: Record<string, unknown> }

/**
 * A call that came from the wire. Its presence is what tells the gate there is no screen to ask
 * on — `consent` is the token from an earlier refusal, absent on the first try.
 */
export type WireCall = { consent?: string }

type Pending = { fingerprint: string; quoted: QuotedBody | null; expiresAt: number }

const pending = new Map<string, Pending>()

/** Key order is what a JSON round trip does not preserve — a client re-serialising its own call
 * must not be told the consent was for another one. */
function fingerprintOf(action: ActionName, input: Record<string, unknown>): string {
  return `${action} ${stableKey(input)}`
}

/**
 * The token a wire call carries, held apart from the input the action reads.
 *
 * Apart rather than declared as a field: `consent` answers FOR the call, it is not one of its
 * parameters, and `readInput` refuses a key no descriptor names.
 */
export function splitConsent(input: Record<string, unknown>): {
  given: Record<string, unknown>
  wire: WireCall
} {
  const { consent, ...given } = input

  return { given, wire: typeof consent === 'string' ? { consent } : {} }
}

function forget(now: number): void {
  for (const [token, held] of pending) if (held.expiresAt <= now) pending.delete(token)

  // Insertion order, so this is the oldest still standing.
  while (pending.size >= MOST_PENDING) {
    const oldest = pending.keys().next()
    if (oldest.done) break
    pending.delete(oldest.value)
  }
}

export function mintConsent(
  action: ActionName,
  input: Record<string, unknown>,
  quoted: QuotedBody | null,
): string {
  const now = Date.now()
  forget(now)

  const token = newId()
  pending.set(token, {
    fingerprint: fingerprintOf(action, input),
    quoted,
    expiresAt: now + LIFETIME_MS,
  })

  return token
}

/** What a token answers for, or `null` — the quoted form being what `formChanged` compares. */
export type Consent = { quoted: QuotedBody | null }

/**
 * Whether a token answers for this call, WITHOUT spending it — a lot clears every call before
 * running any, and must not burn what it then refuses to run.
 *
 * One that does not answer is burnt all the same, or a client could sweep for one that matches.
 */
export function holdsConsent(
  token: string,
  action: ActionName,
  input: Record<string, unknown>,
): Consent | null {
  const held = pending.get(token)
  if (!held) return null

  if (held.expiresAt > Date.now() && held.fingerprint === fingerprintOf(action, input)) {
    return { quoted: held.quoted }
  }

  pending.delete(token)
  return null
}

/** The same answer, and the token spent whether or not it answered. */
export function takeConsent(
  token: string,
  action: ActionName,
  input: Record<string, unknown>,
): Consent | null {
  const held = holdsConsent(token, action, input)
  pending.delete(token)

  return held
}

/** For the suite, which must not have one case's token answer for the next one's call. */
export function forgetConsentsForTests(): void {
  pending.clear()
}
