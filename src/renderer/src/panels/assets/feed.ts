import { stampOfIso, stampOfRow, type AssetRowModel } from './rows'

/**
 * The three lists the shelf shows as one. Named rather than left to free strings: `hungry` travels
 * back to the panel, which asks the source by name, and a typo there is a scroll that silently
 * stops paging one of them.
 */
export type FeedSourceName = 'local' | 'library' | 'published'

/** How far one source of the timeline has been read. */
export type FeedSource = {
  /**
   * The stamp of its last row — every source answers newest first, so nothing it has left can be
   * newer. Absent is not « holds nothing »: an unread source may hold the newest row of all.
   */
  readTo?: string
  /** A source at its end can no longer hold anything back. */
  exhausted: boolean
}

export type FeedResult<T> = {
  /** The rows nothing unread can come before. */
  rows: T[]
  /** The sources holding the rest back, and therefore the ones to ask again. */
  hungry: FeedSourceName[]
}

/**
 * The merged timeline, cut where it stops being certain, and who to ask for the rest. A row is
 * published only when no unread source can come before it — the cut is the OLDEST stamp the open
 * sources have reached, without which a late page inserts rows ABOVE what has been read.
 */
export function mergeFeed<T extends AssetRowModel>(
  rows: readonly T[],
  sources: Readonly<Partial<Record<FeedSourceName, FeedSource>>>,
): FeedResult<T> {
  const open = named(sources).filter(([, source]) => !source.exhausted)
  // Handed back as it came, so a shelf with nothing left to read does not re-allocate per render.
  if (open.length === 0) return { rows: [...rows], hungry: [] }

  const reach = (source: FeedSource): number =>
    source.readTo === undefined ? Number.POSITIVE_INFINITY : stampOfIso(source.readTo)

  const cut = Math.min(...open.map(([, source]) => reach(source)))

  return {
    // Strictly newer, so a source stopped at a stamp keeps back the rows sharing it — a batch
    // generation writes several in the same second. A job carries no stamp and is what is awaited.
    rows: rows.filter(row => row.from === 'job' || stampOfRow(row) > cut),
    // Only the ones sitting on the cut: asking them all spends a quota on what is not missing.
    hungry: open.filter(([, source]) => reach(source) === cut).map(([name]) => name),
  }
}

/** `Object.entries` keeps the keys of a partial record, which the standard signature widens. */
function named(
  sources: Readonly<Partial<Record<FeedSourceName, FeedSource>>>,
): [FeedSourceName, FeedSource][] {
  return NAMES.flatMap(name => {
    const source = sources[name]
    return source ? [[name, source] satisfies [FeedSourceName, FeedSource]] : []
  })
}

const NAMES: readonly FeedSourceName[] = ['local', 'library', 'published']
