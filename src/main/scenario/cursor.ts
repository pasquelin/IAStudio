/**
 * The cursor is empty rather than absent once a listing is exhausted. A SHORT page is not the
 * same thing: with a server-side tag or date filter, the API returns fewer than `pageSize` and
 * still hands back a token, and treating that as the end truncated the catalogue silently.
 * An empty page is the end — that is the guard the SDK's own paginator applies.
 *
 * Shared by the model and asset catalogues: both walk cursor-paginated listings of the same
 * API, and two copies of this rule would be two chances to get the truncation back.
 */
export function tokenAfter(token: string | undefined, received: number): string | null {
  return token && received > 0 ? token : null
}
