import { z } from 'zod'
import type { ModelFamily } from '@shared/domain/model'

const modelId = z.string().trim().min(1)

const family = z.enum([
  'image',
  'video',
  '3d',
  'audio',
  'upscale',
  'background-removal',
  'vectorization',
  'other',
])

export function parseModelId(value: unknown): string {
  return modelId.parse(value)
}

const jobId = z.string().trim().min(1)

export function parseJobId(value: unknown): string {
  return jobId.parse(value)
}

export function parseModelFamily(value: unknown): ModelFamily | undefined {
  return value === undefined ? undefined : family.parse(value)
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
