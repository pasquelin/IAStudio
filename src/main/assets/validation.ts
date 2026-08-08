import { z } from 'zod'
import { ASSET_TYPES, type AssetChanges } from '@shared/domain/asset'
import type { CloudQuery } from '@shared/domain/cloud-asset'
import { SYNC_POLICIES, type SyncPolicy } from '@shared/domain/sync'
import { GET_BULK_MAX, PAGE_SIZE_MAX } from '@main/scenario/limits'

/**
 * What the renderer is allowed to ask of the library.
 *
 * Separate from `project/validation.ts`, which guards the catalogue: these bounds come from the
 * API's own limits rather than from ours, and mixing the two would hide which side each one
 * protects. They REFUSE rather than clamp — a caller asking for three hundred ids has a bug,
 * and silently serving two hundred would hide it while dropping a third of the answer.
 */

const assetId = z.string().trim().min(1)

/** Bounded well below what SQLite would take: the ids travel in one IPC message. */
const assetIds = z.array(assetId).min(1).max(GET_BULK_MAX)

export function parseAssetIds(value: unknown): string[] {
  return assetIds.parse(value)
}

const assetChanges = z.object({
  name: z.string().trim().min(1).max(200).optional(),
  // Replaced wholesale, so an empty list is a real answer — "this asset has no tags".
  tags: z.array(z.string().trim().min(1).max(80)).max(64).optional(),
})

export function parseAssetChanges(value: unknown): AssetChanges {
  return assetChanges.parse(value)
}

const cloudQuery = z.object({
  text: z.string().trim().max(500).optional(),
  tags: z.array(z.string().trim().min(1).max(80)).max(32).optional(),
  types: z.array(z.enum(ASSET_TYPES)).max(ASSET_TYPES.length).optional(),
  collectionId: z.string().trim().min(1).optional(),
  // Opaque and produced by the API; bounded only so a hostile value cannot grow without end.
  cursor: z.string().max(2048).optional(),
  pageSize: z.number().int().min(1).max(PAGE_SIZE_MAX).optional(),
})

export function parseCloudQuery(value: unknown): CloudQuery {
  return cloudQuery.parse(value)
}

const syncPolicy = z.enum(SYNC_POLICIES)

export function parseSyncPolicy(value: unknown): SyncPolicy {
  return syncPolicy.parse(value)
}

export function parseAlsoRemote(value: unknown): boolean {
  return z.boolean().parse(value)
}
