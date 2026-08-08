/**
 * What each bulk endpoint of the API accepts in one call.
 *
 * Gathered here rather than at each call site because they do not follow one rule — 200, 100,
 * 49, 1000 — and because going over one is not a partial success: the request is refused whole,
 * with a 4xx that says nothing about which limit was crossed.
 *
 * Sources, in `docs/scenario-api/reference/`: `assets.get_bulk.md`, `assets.delete_multiple.md`,
 * `assets.list.md`. The collection and batch-download caps join them when those endpoints do.
 */

/** `POST /assets/get-bulk` */
export const GET_BULK_MAX = 200

/** `DELETE /assets` — the only way to delete, there is no single-asset endpoint. */
export const DELETE_MAX = 100

/** `pageSize` on every cursor-paginated listing. Jobs allow 200; assets do not. */
export const PAGE_SIZE_MAX = 100

/**
 * The list cut into runs of at most `size`, in order.
 *
 * An empty input gives no batches rather than one empty batch: callers loop over the result and
 * send each batch, and an empty one would be a request asking for nothing.
 */
export function chunk<T>(items: readonly T[], size: number): T[][] {
  if (size < 1) throw new Error('chunk size must be at least 1')

  const batches: T[][] = []
  for (let start = 0; start < items.length; start += size) {
    batches.push(items.slice(start, start + size))
  }
  return batches
}
