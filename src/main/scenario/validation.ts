import { z } from 'zod'
import { ASSET_NAME_MAX_LENGTH } from '@shared/domain/asset'
import {
  MODEL_FAMILIES,
  MODEL_IDS_BATCH_LIMIT,
  MODEL_ORIGINS,
  MODEL_PERIODS,
  MODEL_SORTS,
  type ModelQuery,
} from '@shared/domain/model'
import {
  PROMPT_IMAGES_MAX,
  PROMPT_INPUT_MAX,
  PROMPT_SUGGESTIONS_MAX,
  type SuggestPromptsRequest,
} from '@shared/domain/prompt-assist'
import { USAGE_PERIODS, type UsagePeriod } from '@shared/domain/usage'

const usagePeriod = z.literal(USAGE_PERIODS)

export function parseUsagePeriod(value: unknown): UsagePeriod {
  return usagePeriod.parse(value)
}

const usageOffset = z.number().int().min(0)

export function parseUsageOffset(value: unknown): number {
  return usageOffset.parse(value)
}

const modelId = z.string().trim().min(1)

export function parseModelId(value: unknown): string {
  return modelId.parse(value)
}

const jobId = z.string().trim().min(1)

export function parseJobId(value: unknown): string {
  return jobId.parse(value)
}

const assetName = z.string().trim().min(1).max(ASSET_NAME_MAX_LENGTH)

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

/**
 * The draft is bounded rather than trusted: the API's own field caps at 250 000 characters on
 * the model measured, and a renderer must not be able to push a megabyte through a channel
 * whose answer is a handful of sentences.
 */
const suggestPrompts = z.object({
  modelId,
  prompt: z.string().max(PROMPT_INPUT_MAX).optional(),
  images: z.array(z.string().trim().min(1)).max(PROMPT_IMAGES_MAX).optional(),
  numResults: z.number().int().min(1).max(PROMPT_SUGGESTIONS_MAX).optional(),
})

export function parseSuggestPrompts(value: unknown): SuggestPromptsRequest {
  return suggestPrompts.parse(value)
}

/** Bounded like the draft above, and non-empty: there is nothing to translate in blank text. */
const promptDraft = z.string().trim().min(1).max(PROMPT_INPUT_MAX)

export function parsePromptDraft(value: unknown): string {
  return promptDraft.parse(value)
}

/** At least one, or there is no style to read; capped where the API caps its references. */
const referenceImages = z.array(z.string().trim().min(1)).min(1).max(PROMPT_IMAGES_MAX)

export function parseReferenceImages(value: unknown): string[] {
  return referenceImages.parse(value)
}
