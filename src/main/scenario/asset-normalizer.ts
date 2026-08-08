import { isRecord } from '@shared/guards'
import { probeNumber, type AssetGeneration } from '@shared/domain/asset'
import { assetTypeOfRemote } from '@shared/domain/asset-kind'
import type { AssetPrivacy, CloudAsset } from '@shared/domain/cloud-asset'

/**
 * Turning an API asset into one the studio can show, from either of the two shapes it arrives in.
 *
 * There are two because `GET /assets` and `POST /search/assets` do not answer with the same
 * record: a search hit has no `kind`, no `properties`, no `status` and no `editCapabilities`,
 * and carries a `teamId` and a `score` instead. Neither is a subset of the other, so one reader
 * would have to treat half its fields as optional and lose the ability to say what is missing.
 *
 * Everything is read defensively. This is an API response, and the alternative to a guard is a
 * crash in the main process on a field that arrived one shape different.
 */

function text(source: Record<string, unknown>, key: string): string | undefined {
  const value = source[key]
  return typeof value === 'string' && value.length > 0 ? value : undefined
}

function strings(value: unknown): string[] {
  return Array.isArray(value) ? value.filter(entry => typeof entry === 'string') : []
}

function privacyOf(value: unknown): AssetPrivacy {
  return value === 'public' || value === 'unlisted' ? value : 'private'
}

/** `{ assetId, url }` on `thumbnail` and `preview` alike. Only the URL is of use here. */
function nestedUrl(value: unknown): string | undefined {
  return isRecord(value) ? text(value, 'url') : undefined
}

/**
 * The prompt and its parameters, when the asset came from a generation.
 *
 * Without a model there is no generation: an uploaded file has none, and `modelLabel` is left
 * as the id because the API never names its models — the panel resolves that separately.
 */
export function generationOfMetadata(
  metadata: Record<string, unknown>,
): AssetGeneration | undefined {
  const modelId = text(metadata, 'modelId')
  if (modelId === undefined) return undefined

  const seed = probeNumber(metadata.seed)
  return {
    modelId,
    modelLabel: modelId,
    prompt: text(metadata, 'prompt') ?? '',
    // The whole of `metadata` rather than a chosen few: what a model accepts is discovered at
    // runtime (invariant 5), so there is no list to pick from here, and the form only ever
    // reads the keys its own descriptors name.
    params: metadata,
    ...(seed === undefined ? {} : { seed }),
  }
}

/**
 * What an asset is called. The API has no top-level `name` — it lives in `metadata`, and is
 * absent on everything that was generated rather than uploaded. The prompt then stands in for
 * it, which is what one actually recognises a generated picture by, and the id is the last
 * resort so that a cell is never blank.
 */
function nameOf(metadata: Record<string, unknown>, id: string): string {
  const name = text(metadata, 'name')
  if (name !== undefined) return name

  const prompt = text(metadata, 'prompt')
  return prompt === undefined ? id : prompt.slice(0, 80)
}

type Shape = { kind?: string; properties?: Record<string, unknown> }

/**
 * The half the two responses agree on. `kind` and `properties` are handed in by the caller
 * because that is precisely where they differ.
 */
function cloudAssetOf(value: unknown, { kind, properties }: Shape): CloudAsset | null {
  if (!isRecord(value)) return null

  const id = text(value, 'id')
  if (id === undefined) return null

  const metadata = isRecord(value.metadata) ? value.metadata : {}
  const mimeType = text(value, 'mimeType')
  const remoteType = text(metadata, 'type') ?? 'unknown'
  // A search hit has no top-level kind, but `metadata.kind` survives in it.
  const type = assetTypeOfRemote({
    kind: kind ?? text(metadata, 'kind'),
    metadataType: remoteType,
    ...(mimeType === undefined ? {} : { mimeType }),
  })
  // Not everything in the library belongs on a shelf: a captioning job's JSON output is data
  // about an asset, not an asset.
  if (type === null) return null

  const width = probeNumber(properties?.width) ?? probeNumber(metadata.width)
  const height = probeNumber(properties?.height) ?? probeNumber(metadata.height)
  const bytes = probeNumber(properties?.size)
  const durationSeconds = probeNumber(properties?.duration)
  const generation = generationOfMetadata(metadata)
  const url = text(value, 'url')
  const thumbnailUrl = nestedUrl(value.thumbnail)

  return {
    id,
    name: nameOf(metadata, id),
    type,
    remoteType,
    ownerId: text(value, 'ownerId') ?? '',
    createdAt: text(value, 'createdAt') ?? '',
    updatedAt: text(value, 'updatedAt') ?? text(value, 'createdAt') ?? '',
    privacy: privacyOf(value.privacy),
    tags: strings(value.tags),
    collectionIds: strings(value.collectionIds),
    ...(url === undefined ? {} : { url }),
    ...(thumbnailUrl === undefined ? {} : { thumbnailUrl }),
    ...(width === undefined ? {} : { width }),
    ...(height === undefined ? {} : { height }),
    ...(bytes === undefined ? {} : { bytes }),
    ...(durationSeconds === undefined ? {} : { durationSeconds }),
    ...(generation === undefined ? {} : { generation }),
  }
}

/** From `GET /assets`, `GET /assets/{id}` and `POST /assets/get-bulk`, which share one schema. */
export function cloudAssetOfListing(value: unknown): CloudAsset | null {
  if (!isRecord(value)) return null

  const kind = text(value, 'kind')
  return cloudAssetOf(value, {
    ...(kind === undefined ? {} : { kind }),
    ...(isRecord(value.properties) ? { properties: value.properties } : {}),
  })
}

/**
 * From `POST /search/assets`, whose hits carry neither `kind` nor `properties`.
 *
 * The dimensions are not lost with `properties`: they are duplicated in `metadata` for anything
 * generated, which is what the shared reader falls back to.
 */
export function cloudAssetOfHit(value: unknown): CloudAsset | null {
  return cloudAssetOf(value, {})
}
