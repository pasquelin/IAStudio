import {
  assetBadgeOf,
  movedSince,
  type Asset,
  type AssetBadge,
  type AssetType,
} from '@shared/domain/asset'
import type { CloudAsset } from '@shared/domain/cloudAsset'
import { runningJobs, type Job } from '@shared/domain/job'

/**
 * One line of the asset browser, whatever it stands for.
 *
 * A view type, and it stays in this folder on purpose: `Asset` and `CloudAsset` are separate in
 * `shared/domain` because one has a file and a hash and the other has neither, and every reader
 * that took a library asset for a local one would have to guard against all three. Merging them
 * down there to save a union up here would undo that.
 *
 * What is shared is the QUESTION the browser asks — what is this, what is it called, where does
 * it live — so the answers are functions over the union rather than fields on a common shape.
 */
export type AssetRowModel =
  | { id: string; from: 'local'; asset: Asset }
  | { id: string; from: 'remote'; asset: CloudAsset }
  | { id: string; from: 'job'; job: Job; type: AssetType | null }

/**
 * Namespaced because a row id addresses one line of one list, while an asset id addresses a row
 * of the catalogue — and the selection store speaks the second. A local line therefore keeps its
 * asset id unprefixed: prefixing it would break every selection the panel already makes.
 */
const REMOTE_PREFIX = 'remote:'
const JOB_PREFIX = 'job:'

/**
 * The asset's own name, for both provenances — which is what the grid draws, what this list
 * draws, and what the search reads. Looking for what is on screen has to find it.
 *
 * It used to be the model that made it, on the grounds that a grid of file names says what one
 * already knows. Two things took that away: a name is now derived from the PROMPT rather than
 * from the model, so it says the thing rather than the machine; and an asset can be renamed, so
 * a caption ignoring the name meant renaming one left it under its old word in the list and
 * unfindable by the new one. The model is still read, where it informs — the inspector's
 * Generation group.
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

/**
 * What a line's mark says, for the two provenances the catalogue cannot answer for.
 *
 * A local line still goes through `assetBadgeOf`, which is the whole point: the rule that reads
 * a catalogue row lives in `shared/` beside the fields it reads, and this only adds the two
 * states a row that does not exist yet can be in.
 */
export function badgeOfRow(row: AssetRowModel, activeOwnerId: string | null): AssetBadge {
  if (row.from === 'remote') return 'remote-only'
  if (row.from === 'job') return 'generating'

  return assetBadgeOf(row.asset, activeOwnerId)
}

/** Everything outside a line that changes what its mark says. */
export type MarkContext = {
  ownerId: string | null
  /** The library page in hand, keyed by its own ids — `twinsById`. */
  twins: ReadonlyMap<string, CloudAsset>
  /** Library ids whose bytes are coming down right now. */
  inFlight: ReadonlySet<string>
  /** Row ids whose file the disk no longer has. */
  absent: ReadonlySet<string>
}

/**
 * The mark one line wears, whole.
 *
 * Here rather than in the panel, and the ORDER is why: it is the subtlest half of the rule —
 * what is moving right now outranks every settled answer, since it is the only state the user is
 * waiting on, and a lost file outranks every sync state, since those all describe a row whose
 * file is here. Split across two modules, that order was the part living furthest from the
 * states it arbitrates between.
 */
export function markOf(row: AssetRowModel, known: MarkContext): AssetBadge {
  if (row.from === 'remote' && known.inFlight.has(row.asset.id)) return 'fetching'
  if (known.absent.has(row.id)) return 'missing'

  const settled = badgeOfRow(row, known.ownerId)
  if (row.from !== 'local' || !row.asset.remoteAssetId) return settled

  return reconciled(row.asset, known.twins.get(row.asset.remoteAssetId)) ?? settled
}

/**
 * The same asset seen from the library, when the panel has read one.
 *
 * This is what makes `to-pull` and `conflict` reachable at all: the catalogue records the twin's
 * stamp as of the last reconciliation, and only a fresh listing says whether the library has
 * moved since. Without a page in hand there is nothing to compare, so an absent entry leaves the
 * row exactly as `assetBadgeOf` judged it rather than guessing it is settled.
 */
export function reconciled(asset: Asset, twin: CloudAsset | undefined): AssetBadge | null {
  if (twin === undefined || asset.remoteAssetId === undefined) return null

  const remoteMoved = movedSince(twin.updatedAt, asset.remoteSyncedAt)
  if (!remoteMoved) return null

  return movedSince(asset.localChangedAt, asset.remoteSyncedAt) ? 'conflict' : 'to-pull'
}

export type MergeInput = {
  local: readonly Asset[]
  /** A page of the account's library, or nothing when it has not been read — or was refused. */
  remote: readonly CloudAsset[]
  jobs: readonly Job[]
  /** The kinds the space in front can take. `null` asks for everything. */
  scope: readonly AssetType[] | null
  /** Rows whose file the disk no longer has, by row id. Empty until the panel has asked. */
  absent: ReadonlySet<string>
}

/**
 * The three provenances as one list, newest first.
 *
 * Order is the point of putting them together: a generation running now, an asset made a minute
 * ago in the browser and one pulled last week belong on the same timeline, and a user looking
 * for "the thing I just made" should not have to know which of three places produced it.
 *
 * The join on `remoteAssetId` happens HERE and nowhere else. Two panels had written it — the
 * home's shelf still does, over its own page — and a tile that answered it for itself would be
 * asking the whole catalogue per cell.
 */
export function mergeRows({ local, remote, jobs, scope, absent }: MergeInput): AssetRowModel[] {
  const wanted = (type: AssetType | null): boolean =>
    scope === null || type === null || scope.includes(type)

  // A generation still going stands for an output nothing holds yet, so nothing can dedupe it:
  // it leaves the list by finishing, at which point the collector has written the real row.
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

  const inLibrary = twinsById(remote)

  /**
   * Rows the project has lost the file of, but whose twin the library still holds.
   *
   * They stop being local lines and let their twin take their place: what is gone is the file,
   * and the asset itself is one download away. Left as local rows they would keep a mark saying
   * "lost" over every gesture that could recover them — the double-click, the drag, the menu are
   * all wired to the provenance, so marking such a row without moving it would have said the
   * thing and offered nothing.
   *
   * A file lost with no twin in the page IS lost as far as this panel can tell, and stays a
   * local row wearing `missing`. The distinction is what the library page can answer for.
   */
  const recoverable = new Set<string>()
  const twinned = new Set<string>()

  for (const asset of local) {
    if (!asset.remoteAssetId) continue

    if (absent.has(asset.id) && inLibrary.has(asset.remoteAssetId)) recoverable.add(asset.id)
    // Held back from the dedup on purpose: the twin has to reappear as a line of its own.
    else twinned.add(asset.remoteAssetId)
  }

  const locals: AssetRowModel[] = local
    .filter(asset => wanted(asset.type) && !recoverable.has(asset.id))
    .map(asset => ({ id: asset.id, from: 'local', asset }))

  const remotes: AssetRowModel[] = remote
    .filter(asset => !twinned.has(asset.id) && wanted(asset.type))
    .map(asset => ({ id: `${REMOTE_PREFIX}${asset.id}`, from: 'remote', asset }))

  /**
   * Sorted, and that is what makes it a timeline rather than three lists in a row.
   *
   * Concatenated alone, a picture generated five minutes ago into the library was drawn after
   * every project row — including one imported a year before. Running generations stay on top
   * whatever their stamp: they are what the user is waiting on.
   */
  return [...running, ...[...locals, ...remotes].sort(newestFirst)]
}

/**
 * Newest first, on the one stamp both provenances carry.
 *
 * A job never reaches here — running generations are placed above the sort — so the comparison
 * only ever sees the two shapes that have a `createdAt`.
 */
function newestFirst(one: AssetRowModel, other: AssetRowModel): number {
  return madeAt(other) - madeAt(one)
}

function madeAt(row: AssetRowModel): number {
  if (row.from === 'job') return 0

  const at = Date.parse(row.asset.createdAt)
  // An unreadable stamp sorts last rather than throwing the whole list into an arbitrary order.
  return Number.isNaN(at) ? 0 : at
}

/**
 * What a tile or a line needs to have its name renamed in place.
 *
 * The panel owns WHICH row is open — one at a time, across both views — and the row owns neither
 * the name nor where it is written; these four are the whole of what crosses between them. Named
 * here rather than written out per host, which is what the grid and the list were each doing.
 */
export type AssetRenameHandle = {
  open: boolean
  start: () => void
  commit: (name: string) => void
  /** Already translated: resolving it per tile runs i18next over two hundred cells. */
  label: string
}

/** The library's page keyed by its own ids, so a local row can find the twin it records. */
export function twinsById(remote: readonly CloudAsset[]): ReadonlyMap<string, CloudAsset> {
  return new Map(remote.map(asset => [asset.id, asset]))
}
