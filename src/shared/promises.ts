/**
 * The value a promise settles on, or `fallback` where it refused — and where there was no promise
 * to begin with.
 *
 * Written because `await thing().catch(() => null)` is banned: under an `await`, a chain hides a
 * `try` nobody can see, and the repository counted 54 of them. What it replaces is an EXPRESSION,
 * so the `try/catch` it would otherwise become — four lines and a `let` — is worse in every one
 * of the 54.
 *
 * Two things it deliberately does, both visible at the call site:
 *
 * `undefined` in also answers `fallback`. Almost every caller reaches through an optional bridge
 * (`getBridge()?.…`), where a window with no bridge and a bridge that refused are the same
 * outcome — a value nobody could read. Callers that need to tell them apart have a `try/catch`.
 *
 * `fallback` is a VALUE, evaluated whether or not it is needed. A fallback expensive enough to
 * mind is a sign the caller wants a `try/catch`, not this.
 */
export async function orElse<T>(promise: Promise<T> | undefined, fallback: T): Promise<T> {
  if (!promise) return fallback

  try {
    return await promise
  } catch {
    return fallback
  }
}
