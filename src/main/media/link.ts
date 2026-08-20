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
   * Self-contained only: served flat as `scenario://asset/<id>`, a `.gltf` 404s on its buffers.
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
 * A row for a file left where it is — empty `path` means « inside », which is why `hash` exists.
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
