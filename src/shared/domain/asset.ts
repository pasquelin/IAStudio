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

export type Asset = {
  id: string
  name: string
  type: AssetType
  location: AssetLocation
  /** Path relative to the project folder when `location` is `local`. */
  path?: string
  /** Originating Scenario identifier, when the asset comes from a generation. */
  remoteAssetId?: string
  jobId?: string
  width?: number
  height?: number
  bytes?: number
  tags: string[]
  createdAt: string
  /** Asset this one derives from — lets us trace a texture back to its source image. */
  derivedFrom?: string
}

export type AssetQuery = {
  type?: AssetType
  tags?: string[]
  text?: string
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
