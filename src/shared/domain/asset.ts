import type { PbrChannel } from './texture'

export type AssetType = 'image' | 'video' | 'audio' | 'mesh' | 'texture' | 'skybox'

/** The values, beside the type: a validator and a row reader both need to enumerate them. */
export const ASSET_TYPES: readonly AssetType[] = [
  'image',
  'video',
  'audio',
  'mesh',
  'texture',
  'skybox',
]

export function isAssetType(value: unknown): value is AssetType {
  return ASSET_TYPES.some(candidate => candidate === value)
}

/**
 * Where each kind lands inside a project. One table rather than two: the folders are created
 * from the project side and written to from the asset side, and a rename on one side alone
 * would have the writer land in a folder nobody created — an ENOENT at the exact moment a job
 * succeeds. `Record<AssetType, string>` also makes a new kind a compile error, not a surprise.
 */
export const ASSET_FOLDERS: Record<AssetType, string> = {
  image: 'assets/img',
  video: 'assets/vid',
  audio: 'assets/aud',
  mesh: 'assets/3d',
  texture: 'assets/tex',
  skybox: 'assets/sky',
}

export type AssetLocation = 'local' | 'cloud'

/**
 * How a local asset stands against the twin it has in the library, when it has one.
 *
 * Separate from `location`, which answers a different question: `location` says whether the
 * bytes are here, this says whether the two sides agree. An asset can be local and ahead, local
 * and behind, or local with no twin at all, and one field could not tell those apart.
 *
 * The studio only ever writes `none`, `synced`, `local-ahead` and `error` today — pushing and
 * pulling are explicit, so nothing drifts behind our back. `remote-ahead` and `conflict` are
 * declared because the timestamps that decide them are already recorded: the day the plan is
 * computed from a full diff rather than from a selection, that is a change of policy in
 * `planSync`, not a migration.
 */
export type SyncStatus = 'none' | 'synced' | 'local-ahead' | 'remote-ahead' | 'conflict' | 'error'

export const SYNC_STATUSES: readonly SyncStatus[] = [
  'none',
  'synced',
  'local-ahead',
  'remote-ahead',
  'conflict',
  'error',
]

export function isSyncStatus(value: unknown): value is SyncStatus {
  return SYNC_STATUSES.some(candidate => candidate === value)
}

/**
 * Peak pairs per second in the waveform written at ingest. Shared because it is the contract
 * between the process that writes the file and the one that paints it: a mismatch would not
 * fail, it would draw the right shape at the wrong speed.
 */
export const PEAKS_PER_SECOND = 50

/** What probing a media file tells us. Durations are microseconds, like the timeline. */
export type MediaProbe = {
  duration: number
  codec: string
  width?: number
  height?: number
  fps?: number
  sampleRate?: number
  channels?: number
}

/**
 * How an asset was produced — what lets the inspector offer to run it again, and what ties a
 * texture back to the prompt that made it.
 *
 * The API is the source of truth here, not the job: a job carries neither `modelId` nor
 * `prompt` at its top level — only an untyped `metadata.input` — while every asset it produces
 * carries both. Reading it off the asset is what makes provenance survive the session that
 * generated it.
 */
export type AssetGeneration = {
  modelId: string
  /** What the model is called, as the panel shows it — « ElevenLabs Music v2 ». */
  modelLabel: string
  prompt: string
  params: Record<string, unknown>
  seed?: number
}

/**
 * A probe from values its reader has already narrowed — ffprobe output on the way in, a
 * catalogue column on the way back. One list of optional fields rather than two: a probe that
 * gains a field must not be able to survive the ingest and vanish on the next read.
 *
 * Without a duration and a codec there is no probe: a clip built on one would have no length.
 */
export function mediaProbeOf(fields: Partial<MediaProbe>): MediaProbe | null {
  const { duration, codec, ...rest } = fields
  return duration === undefined || codec === undefined ? null : { duration, codec, ...rest }
}

/** ffprobe prints its numbers as strings, the catalogue stores them as numbers. Both here. */
export function probeNumber(value: unknown): number | undefined {
  if (typeof value === 'number') return Number.isFinite(value) ? value : undefined
  if (typeof value !== 'string') return undefined

  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : undefined
}

export type Asset = {
  id: string
  name: string
  type: AssetType
  location: AssetLocation
  /** Path relative to the project folder when `location` is `local`. */
  path?: string
  /** Originating Scenario identifier, when the asset comes from a generation. */
  remoteAssetId?: string
  /**
   * The project that holds the twin — `asset.ownerId`, a `proj_…`.
   *
   * An API key carries its own project, so switching accounts changes what `remoteAssetId`
   * even refers to. Without this, an asset pushed under one key would read as « synchronised »
   * under another, against a library that has never heard of it.
   */
  remoteOwnerId?: string
  /** The API's `updatedAt` for the twin. One of the three stamps a sync plan compares. */
  remoteUpdatedAt?: string
  /** When the two sides were last reconciled — the baseline both stamps are measured against. */
  remoteSyncedAt?: string
  /** When this row or its file last moved here. */
  localChangedAt?: string
  syncStatus?: SyncStatus
  /** Why the last sync failed, so the badge can say more than « something went wrong ». */
  syncError?: string
  jobId?: string
  width?: number
  height?: number
  bytes?: number
  tags: string[]
  createdAt: string
  /** Asset this one derives from — lets us trace a texture back to its source image. */
  derivedFrom?: string
  /**
   * What ties the outputs of one generation together — the seven channels of a PBR pack above
   * all. The API has no notion of a group: it answers with siblings that share a `parentId`, a
   * `parentJobId` and nothing else, and dropping a whole material onto the texture space means
   * being able to name the set.
   */
  groupId?: string
  /** Position within that group — `metadata.outputIndex`. Orders the siblings the same way twice. */
  outputIndex?: number
  /**
   * Which PBR channel this asset holds, when it holds one. Named `map` rather than `channel`
   * because `probe.channels` already means audio channels, two fields apart.
   *
   * A texture is a set of channels, and Scenario returns each as an asset of its own: seven
   * siblings under one `derivedFrom` are indistinguishable without this.
   */
  map?: PbrChannel
  /** Set when the pixels read the other way round — a smoothness map stored as roughness. */
  mapInverted?: boolean
  /**
   * Absolute path of a linked external media. A twenty-minute 4K rush is twenty gigabytes: it
   * is linked, never copied into the project, which is why `hash` exists to relink it.
   */
  sourcePath?: string
  /** Content hash — deduplication, cache key, and relink when a folder moves. */
  hash?: string
  probe?: MediaProbe
  /** H.264 720p stand-in, relative to the project folder. */
  proxyPath?: string
  /** Precomputed waveform, relative to the project folder. */
  peaksPath?: string
  /** Absent for an imported file, and for a generated one the catalogue predates. */
  generation?: AssetGeneration
}

/** The kinds that decode as an image — the only ones a thumbnail or a texture slot can use. */
const PICTURES: readonly AssetType[] = ['image', 'texture', 'skybox']

/**
 * Whether this asset is a picture the studio can serve from disk. One answer to the question,
 * because a browser that draws a thumbnail and a texture slot that offers one must not disagree
 * about which assets qualify.
 *
 * The file is not named here: the main process resolves it from the id, for a still copied into
 * the project as much as for one linked where it lies — and the renderer is never told where
 * either sits (`withoutSourcePath`). A file gone missing answers 404, which every consumer of
 * `posterUrl` already falls back from.
 */
export function isLocalPicture(asset: Asset): boolean {
  return PICTURES.includes(asset.type) && asset.location === 'local'
}

/** What the browser paints in the corner of a cell. One name per state the user can act on. */
export type AssetBadge =
  'local-only' | 'synced' | 'to-push' | 'to-pull' | 'conflict' | 'error' | 'other-account'

/**
 * The badge an asset wears, derived rather than stored: it depends on which account is active,
 * and the catalogue outlives the choice of account. Storing it would mean rewriting every row
 * on every key change — and showing a stale answer between the change and the rewrite.
 *
 * `activeOwnerId` is the project the current key opens onto. An asset whose twin lives in
 * another project is shown for what it is instead of being hidden: the file is still here, it
 * is only the library on the other end that has changed.
 */
export function assetBadgeOf(asset: Asset, activeOwnerId: string | null): AssetBadge {
  if (asset.remoteAssetId === undefined) return 'local-only'
  if (
    activeOwnerId !== null &&
    asset.remoteOwnerId !== undefined &&
    asset.remoteOwnerId !== activeOwnerId
  ) {
    return 'other-account'
  }

  switch (asset.syncStatus) {
    case 'synced':
      return 'synced'
    case 'local-ahead':
      return 'to-push'
    case 'remote-ahead':
      return 'to-pull'
    case 'conflict':
      return 'conflict'
    case 'error':
      return 'error'
    default:
      // A twin with nothing said about it is one the catalogue recorded before it tracked
      // sync — an asset collected from a generation. Both sides hold it, and neither has moved.
      return 'synced'
  }
}

/**
 * An asset as the renderer may see it: without the absolute path of the file behind it.
 *
 * The renderer has no filesystem, so a path there is only ever text on screen — and handing it
 * every user's folder layout buys nothing while widening what a compromised dependency in the
 * window could read (CLAUDE.md, invariant 1). What one actually does with a path — show the
 * file in the Finder — is a main-process errand, `assets:reveal`.
 */
export function withoutSourcePath(asset: Asset): Asset {
  if (asset.sourcePath === undefined) return asset

  const rest = { ...asset }
  delete rest.sourcePath
  return rest
}

/**
 * How long the media itself runs, or null when it has no length of its own. A still picture
 * probes as `duration: 0` — a real value, not a missing one — and an asset nobody has probed
 * yet has no probe at all. Both are timeless, and both must reach a caller as the same answer.
 */
export function mediaDuration(asset: Asset | null): number | null {
  const duration = asset?.probe?.duration
  return duration !== undefined && duration > 0 ? duration : null
}

export type AssetQuery = {
  type?: AssetType
  /**
   * Several kinds at once — what a workspace asks for. The Image space wants pictures, textures
   * and skyboxes and nothing else; `type` alone could only ever name one of the three.
   */
  types?: readonly AssetType[]
  tags?: string[]
  text?: string
  /** Narrows to one side of the library, or to what still has to move between them. */
  location?: AssetLocation
  syncStatus?: SyncStatus
  /** The siblings of one generation — the seven channels of a PBR pack. */
  groupId?: string
  limit?: number
  offset?: number
}

export const ASSET_SCHEME = 'scenario'
const ASSET_HOST = 'asset'

/**
 * Where the renderer loads a local asset from. Derived from the identifier rather than asked
 * for over IPC: the answer is a pure function of the id, and asking would mean one round trip
 * and two synchronous SQLite queries per thumbnail on screen.
 *
 * The renderer still never handles a file path — the main process resolves the id against the
 * catalogue when it serves the scheme.
 */
export function assetUrl(assetId: string): string {
  return `${ASSET_SCHEME}://${ASSET_HOST}/${encodeURIComponent(assetId)}`
}

/**
 * The still that stands for an asset — in a browser cell, on a timeline clip. Only pictures
 * have one today: a video's poster frame is produced at ingest, which is still to come, and
 * decoding one here would open a hardware decoder per visible clip.
 */
export function posterUrl(asset: Asset): string | null {
  return isLocalPicture(asset) ? assetUrl(asset.id) : null
}

/** `scenario://asset/<id>` → `<id>`. Anything else is not ours to serve. */
export function assetIdFromUrl(url: string): string | null {
  try {
    const parsed = new URL(url)
    if (parsed.protocol !== `${ASSET_SCHEME}:` || parsed.hostname !== ASSET_HOST) return null

    const id = decodeURIComponent(parsed.pathname.replace(/^\//, ''))
    return id.length > 0 ? id : null
  } catch {
    return null
  }
}
