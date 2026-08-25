import { movedSince, type Asset, type AssetBadge, type AssetType } from '@shared/domain/asset'
import type { CloudAsset } from '@shared/domain/cloudAsset'
import { runningJobs, type Job } from '@shared/domain/job'

/**
 * One line of the remote browser, whatever it stands for.
 *
 * A view type, and it stays in this folder on purpose: `Asset` and `CloudAsset` are separate in
 * `shared/domain` because one has a file and a hash and the other has neither, and every reader
 * that took a library asset for a local one would have to guard against all three.
 *
 * 🛑 There is no local provenance any more, and that is the panel's whole subject: what the
 * project holds is the Explorer's, and listing it here left two surfaces answering the same
 * question with different words.
 */
export type AssetRowModel =
  | {
      id: string
      from: 'remote'
      asset: CloudAsset
      /**
       * Somebody else's, off the public feed, rather than this account's own library.
       *
       * A FLAG and not a second provenance, because nothing about the line behaves differently:
       * neither has a file here, both are fetched by a double-click, both are dragged by
       * `startLibraryDrag` and pulled at the drop. What differs is one word on the badge.
       */
      published?: true
    }
  | { id: string; from: 'job'; job: Job; type: AssetType | null }

/** Namespaced because a row id addresses one line of one list, never a row of the catalogue. */
const REMOTE_PREFIX = 'remote:'
const JOB_PREFIX = 'job:'

/**
 * The asset's own name — which is what the grid draws, what the list draws, and what the index
 * matched. It is derived from the PROMPT rather than from the model that made it, so it says the
 * thing rather than the machine.
 *
 * A job has no asset behind it yet, so it answers with the label it was submitted under.
 */
export function nameOfRow(row: AssetRowModel): string {
  return row.from === 'job' ? row.job.label : row.asset.name
}

/** `null` for a generation: nothing says what it will produce until it answers. */
export function typeOfRow(row: AssetRowModel): AssetType | null {
  return row.from === 'job' ? row.type : row.asset.type
}

/** Everything outside a line that changes what its mark says. */
export type MarkContext = {
  /** Library ids whose bytes are coming down right now. */
  inFlight: ReadonlySet<string>
  /**
   * What the project already holds of this library, by the library's own id — `twinsOfProject`.
   * It is what tells a line one can download from one already downloaded.
   */
  twins: ReadonlyMap<string, Asset>
}

/**
 * The mark one line wears, whole.
 *
 * The ORDER is the subtle half: what is moving right now outranks every settled answer, being
 * the only state the user is waiting on.
 *
 * 🛑 Read from the REMOTE side, which is what the panel losing its local half made possible.
 * `to-pull` and `conflict` used to sit on a project row and be reachable only while a page of
 * the library happened to be in hand; here they are properties of the line one would download,
 * which is where they were always going to be read.
 */
export function markOf(row: AssetRowModel, { inFlight, twins }: MarkContext): AssetBadge {
  if (row.from === 'job') return 'generating'
  if (inFlight.has(row.asset.id)) return 'fetching'

  const held = twins.get(row.asset.id)
  if (held === undefined) return row.published ? 'published' : 'remote-only'

  return reconciled(held, row.asset) ?? 'synced'
}

/**
 * How the copy this project holds stands against the library's own version.
 *
 * `null` when nothing has moved, which is the ordinary answer: the catalogue records the twin's
 * stamp as of the last reconciliation, and only a fresh listing says whether the library has
 * moved since.
 */
export function reconciled(asset: Asset, twin: CloudAsset): AssetBadge | null {
  if (!movedSince(twin.updatedAt, asset.remoteSyncedAt)) return null

  return movedSince(asset.localChangedAt, asset.remoteSyncedAt) ? 'conflict' : 'to-pull'
}

export type MergeInput = {
  /** A page of the account's own library. */
  remote: readonly CloudAsset[]
  /**
   * A page of what everyone else published.
   *
   * Optional: not asking for the feed is the ordinary case — it is unbounded, it would drown an
   * account's own assets, and reading it costs a search quota.
   */
  published?: readonly CloudAsset[]
  jobs: readonly Job[]
  /** The kinds the space in front can take. `null` asks for everything. */
  scope: readonly AssetType[] | null
}

/**
 * The provenances as one list, newest first.
 *
 * Order is the point of putting them together: a generation running now, an asset made a minute
 * ago and one published last week belong on the same timeline, and someone looking for "the
 * thing I just made" should not have to know which produced it.
 */
export function mergeRows({ remote, published = [], jobs, scope }: MergeInput): AssetRowModel[] {
  const wanted = (type: AssetType | null): boolean =>
    scope === null || type === null || scope.includes(type)

  // A generation still going stands for an output nothing holds yet, so nothing can dedupe it:
  // it leaves the list by finishing, at which point the library holds the real asset.
  //
  // Shown whatever the space in front, and that is a decision rather than an oversight: a job
  // does not say what kind it will produce until it answers, and hiding a running generation
  // because its type is unknown is worse than showing one that belongs to another space.
  const running: AssetRowModel[] = runningJobs(jobs).map(job => ({
    id: `${JOB_PREFIX}${job.id}`,
    from: 'job',
    job,
    type: null,
  }))

  const mine: AssetRowModel[] = remote
    .filter(asset => wanted(asset.type))
    .map(asset => ({ id: `${REMOTE_PREFIX}${asset.id}`, from: 'remote', asset }))

  // Deduped against the account's own page, so an asset it happens to own AND to have published
  // is one line — its own, which is the truer of the two. Built only when there IS a feed.
  const publics: AssetRowModel[] = []
  if (published.length > 0) {
    const held = new Set(remote.map(asset => asset.id))
    for (const asset of published) {
      if (held.has(asset.id) || !wanted(asset.type)) continue
      publics.push({ id: `${REMOTE_PREFIX}${asset.id}`, from: 'remote', asset, published: true })
    }
  }

  return [...running, ...newestFirst([...mine, ...publics])]
}

/**
 * Newest first, on the stamp every line carries — read once per ROW and not once per comparison:
 * a listing of eight hundred lines is some fifteen thousand `Date.parse` a sort.
 *
 * A job never reaches here — running generations are placed above the sort.
 */
function newestFirst(rows: readonly AssetRowModel[]): AssetRowModel[] {
  return rows
    .map(row => ({ row, stamp: stampOfRow(row) }))
    .sort((one, other) => other.stamp - one.stamp)
    .map(({ row }) => row)
}

/**
 * When a line was made, as a number. Exported for `mergeFeed`, which cuts the timeline on the
 * same stamp this sorts by — reading it any other way there would cut it in a different order.
 */
export function stampOfRow(row: AssetRowModel): number {
  return row.from === 'job' ? 0 : stampOfIso(row.asset.createdAt)
}

/** An unreadable stamp sorts last rather than throwing the whole list into an arbitrary order. */
export function stampOfIso(createdAt: string): number {
  const at = Date.parse(createdAt)
  return Number.isNaN(at) ? 0 : at
}
