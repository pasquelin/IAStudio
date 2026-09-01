/**
 * What each bulk endpoint of the API accepts in one call.
 *
 * Gathered here rather than at each call site because they do not follow one rule — 200, 100,
 * 49, 1000 — and because going over one is not a partial success: the request is refused whole,
 * with a 4xx that says nothing about which limit was crossed.
 *
 * **Nothing has re-measured them since 2026-08-11**, when the local copy of the API reference that
 * carried them was removed for getting values wrong. A doubt is settled by a call, never by a page.
 *
 * How many calls a minute may hold is another quantity entirely, and lives in `rateLimiter.ts`.
 */

/** `POST /assets/get-bulk` */
export const GET_BULK_MAX = 200

/** `DELETE /assets` — the only way to delete, there is no single-asset endpoint. */
export const DELETE_MAX = 100

/** `pageSize` on every cursor-paginated listing. Jobs allow 200; assets do not. */
export const PAGE_SIZE_MAX = 100

/**
 * How deep into the search index an offset may point.
 *
 * Ours rather than the API's: a cursor is an opaque string, rightly bounded by length alone, so
 * `o:1e99` passes validation and reaches the SDK as a number no index can answer for. Walking to
 * the ceiling is not a dead end — the feed then answers the same page twice, which the caller
 * reads as its end.
 */
export const OFFSET_MAX = 10_000
