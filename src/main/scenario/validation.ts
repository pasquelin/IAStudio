import { z } from 'zod'
import {
  MODEL_FAMILIES,
  MODEL_IDS_BATCH_LIMIT,
  MODEL_ORIGINS,
  MODEL_PERIODS,
  MODEL_SORTS,
  type ModelQuery,
} from '@shared/domain/model'

const modelId = z.string().trim().min(1)

export function parseModelId(value: unknown): string {
  return modelId.parse(value)
}

const jobId = z.string().trim().min(1)

export function parseJobId(value: unknown): string {
  return jobId.parse(value)
}

const assetName = z.string().trim().min(1).max(200)

export function parseAssetName(value: unknown): string {
  return assetName.parse(value)
}

/**
 * Only the payload, never a data URL: an `data:image/png;base64,` prefix reaches the API as
 * part of the picture and comes back as an opaque decoding error.
 */
const base64 = z
  .string()
  .min(1)
  // Only the head: the payload is megabytes long, and a data URL prefix — the one mistake this
  // catches — is at the front. The size is checked before it, in the uploader.
  // The head alone: the payload is megabytes long, and the one mistake worth catching — a
  // `data:image/png;base64,` prefix — is at the front. An unanchored class would match `data`
  // and let the rest through.
  .refine(value => /^[A-Za-z0-9+/=]+$/.test(value.slice(0, 64)), 'expected raw base64')

export function parseBase64(value: unknown): string {
  return base64.parse(value)
}

const facetValue = z.string().trim().min(1).max(80)

/**
 * `limit` is capped rather than trusted: it sizes the walk the registry performs before it
 * answers, and a renderer asking for ten thousand would be asking the main process to freeze.
 */
const modelQuery = z.object({
  // Built from the shared unions, never retyped: a hand-copied list silently stops accepting
  // what the panel offers — `sort: 'oldest'` reached the UI while this schema still refused it.
  family: z.enum(MODEL_FAMILIES).optional(),
  search: z.string().trim().max(200).optional(),
  origin: z.enum(MODEL_ORIGINS).optional(),
  capabilities: z.array(facetValue).max(20).optional(),
  tags: z.array(facetValue).max(20).optional(),
  since: z.enum(MODEL_PERIODS).optional(),
  sort: z.enum(MODEL_SORTS).optional(),
  cursor: z.string().max(500).optional(),
  limit: z.number().int().min(1).max(100).optional(),
})

export function parseModelQuery(value: unknown): ModelQuery {
  return value === undefined ? {} : modelQuery.parse(value)
}

const modelIds = z.array(modelId).max(MODEL_IDS_BATCH_LIMIT)

export function parseModelIds(value: unknown): string[] {
  return modelIds.parse(value)
}

/**
 * Generation bodies are model-specific and typed `unknown` by the API itself — see spec § 6.
 * Only the envelope is checked here: a record of values, not an array and not a primitive.
 * What the keys mean is the model's business, and pretending otherwise would mean freezing a
 * schema Scenario deliberately keeps dynamic.
 */
const generationBody = z.record(z.string(), z.unknown())

export function parseGenerationBody(value: unknown): Record<string, unknown> {
  return generationBody.parse(value)
}
