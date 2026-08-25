import { movedSince, type Asset, type AssetBadge, type AssetType } from '@shared/domain/asset'
import type { CloudAsset } from '@shared/domain/cloudAsset'
import { runningJobs, type Job } from '@shared/domain/job'

/**
 * One line of the remote browser, whatever it stands for. A view type, kept here because `Asset`
 * and `CloudAsset` are separate in `shared/domain` — one has a file and a hash, the other neither.
 *
 * 🛑 No local provenance: what the project holds is the Explorer's subject.
 */
export type AssetRowModel =
  | {
      id: string
      from: 'remote'
      asset: CloudAsset
      /**
       * Somebody else's, off the public feed. A FLAG and not a second provenance: nothing about
       * the line behaves differently, only one word on its badge.
       */
      published?: true
    }
  | { id: string; from: 'job'; job: Job; type: AssetType | null }

/**
 * The two tooltips a cell may carry, built once by the panel: a `useTranslation` inside a cell
 * subscribes each of two hundred of them to i18next and allocates a fresh attribute object per
 * frame of a scroll.
 */
export type RowHints = { fetch: Record<string, string>; generating: Record<string, string> }

/** Namespaced because a row id addresses one line of one list, never a row of the catalogue. */
const REMOTE_PREFIX = 'remote:'
const JOB_PREFIX = 'job:'

/**
 * The asset's own name, derived from the PROMPT rather than from the model that made it — it says
 * the thing rather than the machine. A job answers with the label it was submitted under.
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
 * The mark one line wears. What is moving right now outranks every settled answer, being the only
 * state the user is waiting on.
 *
 * 🛑 Read from the REMOTE side: `to-pull` and `conflict` are properties of the line one would
 * download, and used to be reachable only while a page of the library happened to be in hand.
 */
export function markOf(row: AssetRowModel, { inFlight, twins }: MarkContext): AssetBadge {
  if (row.from === 'job') return 'generating'
  if (inFlight.has(row.asset.id)) return 'fetching'

  const held = twins.get(row.asset.id)
  if (held === undefined) return row.published ? 'published' : 'remote-only'

  return reconciled(held, row.asset) ?? 'synced'
}

/**
 * How the copy this project holds stands against the library's own. `null` when nothing moved:
 * only a fresh listing says whether the library has, the catalogue holding the stamp of the last
 * reconciliation.
 */
export function reconciled(asset: Asset, twin: CloudAsset): AssetBadge | null {
  if (!movedSince(twin.updatedAt, asset.remoteSyncedAt)) return null

  return movedSince(asset.localChangedAt, asset.remoteSyncedAt) ? 'conflict' : 'to-pull'
}

export type MergeInput = {
  /** A page of the account's own library. */
  remote: readonly CloudAsset[]
  /** A page of what everyone else published, empty while nobody asks for the feed. */
  published: readonly CloudAsset[]
  /** The kinds the space in front can take. */
  scope: readonly AssetType[]
}

/**
 * The two libraries as one list, newest first: someone looking for "the thing I just made" should
 * not have to know which produced it.
 *
 * 🛑 Generations are NOT here — a job reports progress every couple of seconds, and folding them
 * in would re-sort eight hundred lines for a bar moving on one tile. See `runningRows`.
 */
export function mergeRows({ remote, published, scope }: MergeInput): AssetRowModel[] {
  const wanted = (type: AssetType): boolean => scope.includes(type)

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

  return newestFirst([...mine, ...publics])
}

/**
 * The generations still going, above the sort: they are what the user is waiting on, and a job
 * leaves the list by finishing. Shown whatever the space in front — a job does not say what kind
 * it will produce, and hiding one for that is worse than showing one of another space.
 */
export function runningRows(jobs: readonly Job[]): AssetRowModel[] {
  return runningJobs(jobs).map(job => ({
    id: `${JOB_PREFIX}${job.id}`,
    from: 'job',
    job,
    type: null,
  }))
}

/**
 * Newest first, the stamp read once per ROW and not per comparison: eight hundred lines is some
 * fifteen thousand `Date.parse` a sort. A job never reaches here.
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
