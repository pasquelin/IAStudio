import { basename, extname } from 'node:path'
import type { Asset, AssetType } from '@shared/domain/asset'

/** The kinds a file on disk can be linked as. Generated assets cover the rest. */
export type ImportableType = Extract<AssetType, 'video' | 'audio' | 'image' | 'mesh'>

const IMPORTABLE_TYPES: readonly ImportableType[] = ['video', 'audio', 'image', 'mesh']

const EXTENSIONS: Record<ImportableType, readonly string[]> = {
  video: ['mp4', 'mov', 'mkv', 'webm', 'avi', 'mxf', 'm4v'],
  audio: ['wav', 'mp3', 'aac', 'flac', 'm4a', 'ogg'],
  image: ['png', 'jpg', 'jpeg', 'webp', 'tif', 'tiff', 'exr', 'hdr'],
  /**
   * The SELF-CONTAINED shapes, and only those. An asset is served flat as `scenario://asset/<id>`,
   * so a file pointing at siblings by relative path — `.gltf` at its buffers, `.dae` at its
   * textures — would 404 on every one and show an empty model with nothing said.
   *
   * `.obj` is the line to know: it names a `.mtl` this side never fetches, so its shapes arrive
   * dressed in the loader's default rather than white and silent.
   */
  mesh: ['glb', 'obj', 'fbx', 'stl', 'ply', 'usdz'],
}

/** The kind of editor a file opens in, read from its extension — or nothing we can montage. */
export function assetTypeOf(path: string): ImportableType | null {
  const extension = extname(path).slice(1).toLowerCase()
  if (!extension) return null

  return IMPORTABLE_TYPES.find(type => EXTENSIONS[type].includes(extension)) ?? null
}

export type LinkOptions = { id: string; type: AssetType; now: string }

/**
 * A catalogue row pointing at a file left where it is. `path` stays empty on purpose: it means
 * "inside the project", and this one is not — that is the whole reason `hash` exists.
 */
export function linkedAsset(source: string, { id, type, now }: LinkOptions): Asset {
  return {
    id,
    name: basename(source, extname(source)),
    type,
    location: 'local',
    sourcePath: source,
    tags: [],
    createdAt: now,
  }
}

export type MediaFilter = { name: string; extensions: string[] }

/** What the open dialog offers, named in the user's language — a native dialog shows them. */
export function mediaFilters(labels: Record<'all' | ImportableType, string>): MediaFilter[] {
  return [
    { name: labels.all, extensions: IMPORTABLE_TYPES.flatMap(type => EXTENSIONS[type]) },
    ...IMPORTABLE_TYPES.map(type => ({ name: labels[type], extensions: [...EXTENSIONS[type]] })),
  ]
}
