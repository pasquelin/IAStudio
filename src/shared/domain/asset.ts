import { FILE_NAME_MAX_LENGTH } from './fileName'
import type { PbrChannel } from './material'

export type AssetType = 'image' | 'video' | 'audio' | 'mesh' | 'skybox' | 'animation'

/** The values, beside the type: a validator and a row reader both need to enumerate them. */
export const ASSET_TYPES: readonly AssetType[] = [
  'image',
  'video',
  'audio',
  'mesh',
  'skybox',
  'animation',
]

/**
 * A kind the API can be ASKED for. Every other list narrows to this one before a request.
 *
 * MEASURED: the API has no animation class at all — the Uthana file carrying a capoeira is filed
 * `kind: '3d'` there, beside the characters. A tab offering animations against the cloud would
 * therefore promise motion and list models, which is why this split exists rather than one list.
 */
export type CloudAssetType = Exclude<AssetType, 'animation'>

export const CLOUD_ASSET_TYPES: readonly CloudAssetType[] = ASSET_TYPES.filter(isCloudAssetType)

export function isCloudAssetType(type: AssetType): type is CloudAssetType {
  return type !== 'animation'
}

export function isAssetType(value: unknown): value is AssetType {
  return ASSET_TYPES.some(candidate => candidate === value)
}

/**
 * Where each kind lands when nothing says otherwise — a DEFAULT, no longer a law.
 *
 * It used to be both: the folder a file sat in is what said what the file was, so leaving one
 * meant ceasing to be a picture. Nothing reads a role off a folder any more (`natureOf` reads
 * the extension, the catalogue overrules it), so these are ordinary folders the user may rename,
 * fill with something else, or throw away — and the writer recreates the one it needs rather
 * than failing, which is the whole difference between a default and a law.
 *
 * The names are English and fixed, never translated: a folder whose name followed the interface
 * language would be renamed on disk at every language change, and every catalogue row under it
 * would point beside the file.
 *
 * `Record<AssetType, string>` still makes a new kind a compile error rather than a surprise.
 *
 * A DEFAULT and nothing more, which is what made dropping `Textures` safe: a project that filed
 * pictures there keeps them — every row carries its own path — and only what it takes in from now
 * on lands under `Images` with the rest.
 */
export const DEFAULT_ASSET_FOLDERS: Record<AssetType, string> = {
  image: 'Images',
  video: 'Video',
  audio: 'Audio',
  mesh: '3D',
  skybox: 'Sky',
  animation: 'Animations',
}

/**
 * What every asset id starts with, ours and Scenario's alike — the two vocabularies share the
 * spelling and nothing else. Written down because the main process reads it to tell a value that
 * may name an asset from one that cannot, before asking the catalogue about it.
 */
export const ASSET_ID_PREFIX = 'asset_'

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

/**
 * How long an asset's name may be.
 *
 * Shared rather than repeated at each boundary: the rename channel has always refused more, and
 * a name written straight into the catalogue — as automatic captioning does — must be held to
 * the same rule. A caption is a sentence, and a row whose name is a paragraph is unreadable in
 * every list that shows it.
 *
 * It IS the file name's bound, and not a bound of its own, since the name reached the file:
 * a catalogue holding 200 characters over a file cut at 80 is the two-name problem back, one
 * layer down — the shelf would read one thing and the explorer another, which is exactly what
 * `assetFileName` exists to stop.
 */
export const ASSET_NAME_MAX_LENGTH = FILE_NAME_MAX_LENGTH

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
   * `parentJobId` and nothing else, and dropping a whole material onto the materials space means
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
   * The glTF slot an extracted picture came out of, when `map` cannot name it — a
   * `metallicRoughnessTexture` packs two channels into one image, a `clearcoatTexture` names one
   * the studio has no channel for. Without it the two are indistinguishable, and offering to
   * unpack either would write a roughness out of a coat.
   */
  packedSlot?: string
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
  /**
   * A still standing for an asset that is not itself a picture — a mesh above all, whose file no
   * browser can decode. Relative to the project folder, and rebuildable: it is the library's own
   * thumbnail, brought down beside the bytes rather than kept only in a listing that expires.
   *
   * Without it a downloaded model is an icon in a grid it was a picture in one gesture earlier,
   * which is exactly how "the thumbnail disappears when I download" was reported.
   */
  posterPath?: string
  /** Absent for an imported file, and for a generated one the catalogue predates. */
  generation?: AssetGeneration
}

/** The kinds that decode as an image — the only ones a thumbnail or a texture slot can use. */
export const PICTURES: readonly AssetType[] = ['image', 'skybox']

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

/**
 * What the browser paints in the corner of a cell. One name per state the user can act on.
 *
 * Most of them describe a row the catalogue holds. Two stand for a line it does NOT — a library
 * asset and a running generation — and that is deliberate: the browser lists both alongside what
 * is on disk, so the vocabulary that says WHERE a thing is has to reach what is not here yet.
 *
 * The count is left out of this sentence on purpose: it went stale twice in one afternoon, and
 * `exhaustive.test.ts` is what actually holds the list to the union.
 */
export type AssetBadge =
  | 'local-only'
  | 'synced'
  | 'to-push'
  | 'to-pull'
  | 'conflict'
  | 'error'
  | 'other-account'
  /** In the account's library, with no copy on this disk. Nothing local answers for it. */
  | 'remote-only'
  /**
   * Published by somebody else — the public feed, which this account owns nothing of. It behaves
   * exactly as `remote-only` does (no file here, fetched by a double-click or by a drop) and it
   * is a mark of its own for the one thing that differs: whose it is.
   */
  | 'published'
  /** A job is still running. The row stands for an output that does not exist yet. */
  | 'generating'
  /** Its bytes are on their way down right now. Transient, and never read off a stored row. */
  | 'fetching'
  /** The catalogue records a file the disk no longer has — deleted or moved outside the studio. */
  | 'missing'

/**
 * Whether this asset's twin lives in a project the active key does not open onto.
 *
 * Shared by the badge and by the sync planner, which is the point: the tile saying "in sync"
 * while the plan says "skipped, other account" is a disagreement nothing would have caught.
 *
 * A `null` account means nothing has said which project is open yet — judged as "do not judge"
 * rather than as a mismatch, since guessing would strand every asset behind a false warning.
 */
export function isForeignTwin(
  twin: Pick<Asset, 'remoteOwnerId'>,
  activeOwnerId: string | null,
): boolean {
  return (
    activeOwnerId !== null &&
    twin.remoteOwnerId !== undefined &&
    twin.remoteOwnerId !== activeOwnerId
  )
}

/**
 * Whether a stamp is later than the baseline.
 *
 * Parsed rather than compared as text: both stamps are ISO today, but one comes from the API and
 * one from us, and a string comparison would quietly give the wrong answer the day one of them
 * carries an offset instead of a Z. An unreadable stamp counts as "not moved" — refusing to act
 * on a date nobody can read beats pushing over a file on the strength of it.
 *
 * Beside `isForeignTwin` because the two answer the halves of one question — is the twin this
 * asset records still the one the API would serve — and are read by the badge, by the sync
 * planner and by what translates a body before a job runs.
 */
export function movedSince(stamp: string | undefined, baseline: string | undefined): boolean {
  if (stamp === undefined) return false
  if (baseline === undefined) return true

  const at = Date.parse(stamp)
  const since = Date.parse(baseline)
  return Number.isNaN(at) || Number.isNaN(since) ? false : at > since
}

export const ASSET_BADGES: readonly AssetBadge[] = [
  'local-only',
  'synced',
  'to-push',
  'to-pull',
  'conflict',
  'error',
  'other-account',
  'remote-only',
  'published',
  'generating',
  'fetching',
  'missing',
]

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
  if (isForeignTwin(asset, activeOwnerId)) return 'other-account'

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
      // Provenance, not a twin: a generation lands a file so a resume does not download twice.
      return 'local-only'
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

/**
 * Whether the media has no length of its own — a picture, however it was generated. Not the same
 * question as `mediaDuration` answering null, which also covers an asset nobody has probed yet:
 * that one has a source whose length is merely unknown, and an edit treating the two alike would
 * run a clip off the end of its own rush. A trim needs them apart; a drop does not.
 */
export function isTimeless(asset: Asset | null): boolean {
  return asset !== null && PICTURES.includes(asset.type)
}

/**
 * The kinds whose own file no surface can paint, and which therefore get a still of their own.
 *
 * A picture answers for itself. A sound must NOT be given one: a timeline clip reads `posterUrl`
 * like every other surface, and the still would be painted under its waveform. What is left is
 * a mesh — nothing decodes a `.glb` — and a rush, whose first frame is the only thing that tells
 * one take from another in a shelf of grey rectangles.
 *
 * Here rather than beside either producer: a still comes down with a generated asset and is
 * grabbed by ffmpeg for an imported one, and the two must not answer this differently.
 */
export const POSTER_KINDS: readonly AssetType[] = ['mesh', 'video']

export function wantsPoster(type: AssetType): boolean {
  return POSTER_KINDS.includes(type)
}

/**
 * Whether the media carries a sound of its own. `channels` is only ever written when ffprobe
 * found an audio stream, so its absence is the answer — for a silent rush AND for one nobody
 * has probed, which a montage must treat alike: there is no sound it could lay down either way.
 */
export function hasSound(asset: Asset | null): boolean {
  return (asset?.probe?.channels ?? 0) > 0
}

/**
 * How many paths one `AssetQuery` may ask about.
 *
 * Read on BOTH sides, which is the whole point: the main process refuses a longer list — one
 * placeholder each in a statement it builds — and the caller cuts its question into that many
 * before asking. Written on one side only, a project of three thousand rushes lost every
 * catalogue answer at once and fell back to guessing from extensions, silently.
 */
export const ASSET_PATHS_MAX = 2000

/**
 * The widest `limit` one `AssetQuery` may ask for. Read on both sides like `ASSET_PATHS_MAX`: the
 * main process REFUSES a larger one rather than trimming it, so a caller that cuts its reads into
 * batches has to know where the refusal starts.
 */
export const ASSET_SEARCH_LIMIT_MAX = 500

export type AssetQuery = {
  type?: AssetType
  /**
   * Several kinds at once — what a workspace asks for. The Image space wants pictures, textures
   * and skyboxes and nothing else; `type` alone could only ever name one of the three.
   */
  types?: readonly AssetType[]
  tags?: string[]
  text?: string
  /**
   * The asset filed at exactly this path, relative to the project — how the explorer asks
   * whether a file it is showing is one of ours.
   *
   * Exact, not a prefix: the question is « is this file an asset », and the folder walked by the
   * explorer spells its paths the way `relativePathFor` writes them — `/` on every platform.
   */
  path?: string
  /**
   * The same question for a whole listing — which of THESE files the catalogue holds a row for.
   *
   * One round trip rather than one per row: a browser showing four hundred files asked four
   * hundred times, and each answer is a query against the project's own database. An empty list
   * means nothing, as it does for `types`.
   *
   * Bounded by `ASSET_PATHS_MAX`, which the caller is the one to respect: a longer list is
   * REFUSED rather than cut, and a folder of rushes goes past it easily.
   */
  paths?: readonly string[]
  /**
   * Exactly these rows, by id — how a caller holding the output of a generation reads it back.
   *
   * `metadata.assetIds` is all a finished job hands over, and until this the catalogue could be
   * asked by path, by group and by origin but never by the one identifier the API itself
   * answers in. Empty means nothing, as it does for `paths`.
   */
  ids?: readonly string[]
  /**
   * Which of THESE library assets this project already holds — the question the remote browser
   * asks of every page it draws.
   *
   * Asked of the catalogue rather than answered from the rows a window happens to be holding:
   * that store pages the catalogue two hundred at a time, so a project with more than that would
   * have offered a download of a file already on the disk. Bounded by `ASSET_PATHS_MAX` and
   * empty means nothing, both exactly as `paths` above — one placeholder each in a statement the
   * main process builds.
   */
  remoteAssetIds?: readonly string[]
  /** Narrows to one side of the library, or to what still has to move between them. */
  location?: AssetLocation
  syncStatus?: SyncStatus
  /** The siblings of one generation — the seven channels of a PBR pack. */
  groupId?: string
  /**
   * What came OUT of one asset — the pictures taken out of a model's file above all.
   *
   * The column is already there and indexed; nothing asked it anything until a model's own
   * textures had to be shown beside it in the inspector.
   */
  derivedFrom?: string
  /**
   * What a model produced, as opposed to what was imported. Only ever asked for affirmatively:
   * "everything that was NOT generated" is a question no surface asks, and a branch nothing
   * reaches is a branch nothing tests.
   */
  generated?: true
  /** Bounded by `ASSET_SEARCH_LIMIT_MAX`, past which the query is refused rather than cut. */
  limit?: number
  offset?: number
}

/**
 * How many assets of each kind a project holds. Every kind is present, zero included: a counter
 * that vanishes when it reaches nothing is a counter that reads as a bug rather than as a total.
 */
export type AssetCounts = Record<AssetType, number>

/**
 * A fresh tally at zero. A literal rather than built from `ASSET_TYPES`, so a kind added is a
 * compile error here instead of a counter silently missing from five hand-written copies.
 */
export function emptyAssetCounts(): AssetCounts {
  return { image: 0, video: 0, audio: 0, mesh: 0, skybox: 0, animation: 0 }
}

/**
 * What may be changed about an asset from the interface. An absent field is left alone, which is
 * what lets a rename and a retagging travel through the same channel without one erasing the
 * other — tags are replaced wholesale, so `[]` genuinely means « no tags ».
 */
export type AssetChanges = {
  name?: string
  tags?: readonly string[]
  /**
   * What the file IS, corrected by hand.
   *
   * The studio reads a file's domain from its extension alone, and an extension cannot always
   * tell: a normal map and an albedo are both PNGs. The row is what remembers the answer, which
   * is why only a file the catalogue holds can be corrected at all.
   */
  type?: AssetType
}

export const ASSET_SCHEME = 'ia-studio'
export const ASSET_HOST = 'asset'

/**
 * The original bytes, for an export that must not downsample a 4K H.264 take the monitor
 * plays through its proxy. Same scheme, different host, so the resolver cannot guess.
 */
export const MASTER_HOST = 'master'

/**
 * The host that serves an asset's still rather than the asset itself. A host of its own, and not
 * a parameter on `asset`: one id names one file per host, and a mesh's `.glb` and its `.jpg` are
 * two files — the resolver would otherwise have to guess which of them a caller meant.
 */
export const POSTER_HOST = 'poster'

/**
 * The host that serves a PREVIEW of a file in the project, named by its path rather than by an
 * id — the explorer shows files, and most of them have no catalogue row at all. What it hands
 * back is a small picture the main process rendered and kept under `.index/thumbnails`.
 */
export const THUMB_HOST = 'thumb'

/**
 * `ia-studio://<host>/<id>`. One scheme, one host per kind of thing it serves — the favourites
 * keep their stills outside any project, so they answer on a host of their own.
 */
export function hostedUrl(host: string, id: string): string {
  return `${ASSET_SCHEME}://${host}/${encodeURIComponent(id)}`
}

/** What a URL of the scheme names, or null when it is not one of ours. */
export function hostedParts(url: string): { host: string; id: string } | null {
  try {
    const parsed = new URL(url)
    if (parsed.protocol !== `${ASSET_SCHEME}:`) return null

    const id = decodeURIComponent(parsed.pathname.replace(/^\//, ''))
    return id.length > 0 ? { host: parsed.hostname, id } : null
  } catch {
    return null
  }
}

/** The id back out, or null when the URL names another host — which is not ours to serve. */
export function hostedIdFromUrl(url: string, host: string): string | null {
  const parts = hostedParts(url)
  return parts?.host === host ? parts.id : null
}

/**
 * Where the renderer loads a local asset from. Derived from the identifier rather than asked
 * for over IPC: the answer is a pure function of the id, and asking would mean one round trip
 * and two synchronous SQLite queries per thumbnail on screen.
 *
 * The renderer still never handles a file path — the main process resolves the id against the
 * catalogue when it serves the scheme.
 */
export function assetUrl(assetId: string): string {
  return hostedUrl(ASSET_HOST, assetId)
}

export function assetMasterUrl(assetId: string): string {
  return hostedUrl(MASTER_HOST, assetId)
}

/**
 * What the explorer draws on the tile of a file it lists, asset or not.
 *
 * Keyed by the path and NOT versioned, which is the one thing to know about it: a file replaced
 * on disk outside the studio keeps the preview the window already decoded until that window
 * reloads. The cache on disk sees the change — it keys on the size and the stamp — but the URL
 * it answers is the same one, and nothing here can tell the browser to ask again.
 */
export function thumbnailUrl(relativePath: string): string {
  return hostedUrl(THUMB_HOST, relativePath)
}

/**
 * The still that stands for an asset — in a browser cell, on a timeline clip. A picture answers
 * for itself; anything else answers with the still recorded beside it, which today means a mesh
 * brought down from the library. A video has neither: its poster frame is produced at ingest,
 * which is still to come, and decoding one here would open a hardware decoder per visible clip.
 *
 * Stamped with `localChangedAt`, and that is what makes a REWRITTEN asset repaint: an id alone
 * is a stable URL, so a browser that already decoded it keeps the bitmap it holds and a ⌘S that
 * overwrote the file would look like a gesture that did nothing. The stamp rides in the query,
 * which the resolver never reads — it resolves the path.
 *
 * It lives HERE rather than on `assetUrl` because this is the one that knows the asset: a
 * version parameter on `assetUrl` would widen a pure function for its fourteen callers to serve
 * three, and `.map(assetUrl)` would then quietly pass the index as the version.
 */
export function posterUrl(asset: Asset): string | null {
  if (isLocalPicture(asset)) return versionedUrl(assetUrl(asset.id), asset.localChangedAt)
  // `local` said out loud rather than left to the fact that nothing writes a poster path on a
  // cloud row: the still is a file inside the open project, so a row from anywhere else would
  // send the window after a picture no resolver can answer for — a 404 where an icon belongs.
  if (asset.posterPath && asset.location === 'local') {
    return versionedUrl(hostedUrl(POSTER_HOST, asset.id), asset.localChangedAt)
  }
  return null
}

/**
 * The same URL, told apart from the one that named the file before it was overwritten.
 *
 * The version is `localChangedAt` at every call site: an id alone is a stable URL, so whoever
 * decoded it once — a browser cell, a WebGL texture cache — keeps the bitmap it holds, and a ⌘S
 * that rewrote the file looks like a gesture that did nothing.
 *
 * Apart from `posterUrl` because a texture slot has no `Asset` in hand, only an id and a stamp
 * looked up beside it. The resolver never reads the query; it resolves the path.
 */
export function versionedUrl(url: string, version: string | undefined): string {
  return version ? `${url}?v=${encodeURIComponent(version)}` : url
}

/** `ia-studio://asset/<id>` → `<id>`. Anything else is not ours to serve. */
export function assetIdFromUrl(url: string): string | null {
  return hostedIdFromUrl(url, ASSET_HOST)
}
