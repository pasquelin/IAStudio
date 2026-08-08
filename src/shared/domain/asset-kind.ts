import type { AssetType } from './asset'
import { channelFromScenarioType } from './texture'

/**
 * What the API says about an asset's nature, gathered from the three separate fields it uses.
 *
 * Three, not one, and they disagree by design:
 *   - `kind` is the media class — eight values, the coarse sort.
 *   - `metadataType` is the provenance — eighty values, and the only axis `GET /assets` filters
 *     on. It is what separates a normal map from an albedo, both of which are `kind: 'image'`.
 *   - `mimeType` is the file itself, and the only one left on a hit from `/search/assets`, whose
 *     response schema drops `kind` entirely.
 *
 * Every field is optional because every one of them is absent from some response.
 */
export type RemoteTyping = {
  kind?: string
  metadataType?: string
  mimeType?: string
}

/** Skyboxes announce themselves in `metadata.type` and nowhere else once they are plain LDR. */
function isSkyboxType(metadataType: string): boolean {
  return metadataType.startsWith('skybox') || metadataType === 'upscale-skybox'
}

/**
 * A picture of a material, as opposed to one channel of one. `texture`, `upscale-texture` and
 * the `inference-*-texture` family all describe a surface, and the studio files them as such.
 */
function isTextureType(metadataType: string): boolean {
  return metadataType === 'texture' || metadataType.endsWith('-texture')
}

const TYPE_BY_KIND: Record<string, AssetType> = {
  image: 'image',
  // HDR images are what the skybox space consumes, and nothing else produces them.
  'image-hdr': 'skybox',
  video: 'video',
  audio: 'audio',
  '3d': 'mesh',
}

const TYPE_BY_MIME_PREFIX: Record<string, AssetType> = {
  'image/': 'image',
  'video/': 'video',
  'audio/': 'audio',
  'model/': 'mesh',
  // The one 3D format the API accepts that is not served under `model/`.
  'application/vnd.autodesk.fbx': 'mesh',
}

/**
 * Which shelf an API asset belongs on, or `null` when it belongs on none — a `json` or `text`
 * output of a captioning job is data *about* an asset, not an asset.
 *
 * The order matters more than the table does:
 *
 * 1. A PBR channel is a texture whatever its `kind` says. One converter job answers with seven
 *    pictures, and filing them as plain images would lose the whole material.
 * 2. An explicit non-image `kind` is trusted next: it is the API's own coarse answer.
 * 3. Only then `metadata.type`, which is what rescues the skyboxes. A 360 produced by
 *    `skybox-base-360` is `kind: 'image'` — trusting `kind` alone filed every LDR skybox as an
 *    ordinary picture, and the skybox space never saw the thing it had just generated.
 * 4. `mimeType` last, for search hits, which carry no `kind` at all.
 *
 * The eighty values are not enumerated. Only the prefixes that change the answer are, because
 * the API adds types without warning and an unknown one must land somewhere sensible rather
 * than vanish.
 */
export function assetTypeOfRemote({
  kind,
  metadataType,
  mimeType,
}: RemoteTyping): AssetType | null {
  if (metadataType !== undefined && channelFromScenarioType(metadataType)) return 'texture'

  const byKind = kind === undefined ? undefined : TYPE_BY_KIND[kind]
  if (byKind !== undefined && byKind !== 'image') return byKind

  if (metadataType !== undefined) {
    if (isSkyboxType(metadataType)) return 'skybox'
    if (isTextureType(metadataType)) return 'texture'
  }

  if (byKind !== undefined) return byKind

  const prefix = Object.keys(TYPE_BY_MIME_PREFIX).find(candidate => mimeType?.startsWith(candidate))
  return prefix === undefined ? null : (TYPE_BY_MIME_PREFIX[prefix] ?? null)
}
