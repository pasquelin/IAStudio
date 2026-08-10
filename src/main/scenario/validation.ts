import { z } from 'zod'
import { ASSET_NAME_MAX_LENGTH } from '@shared/domain/asset'
import {
  GRAPH_EDGES_MAX,
  GRAPH_ID_MAX,
  GRAPH_NODES_MAX,
  GRAPH_NODE_TYPES,
  type GraphState,
} from '@shared/domain/graph'
import { JOB_KINDS, type JobTarget } from '@shared/domain/job'
import type { PersistedJob } from './job-store'
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
import { USAGE_PERIODS, type UsageCursors, type UsagePeriod } from '@shared/domain/usage'
import { WORKFLOW_PRIVACIES, type WorkflowQuery } from '@shared/domain/workflow'

const usagePeriod = z.literal(USAGE_PERIODS)

export function parseUsagePeriod(value: unknown): UsagePeriod {
  return usagePeriod.parse(value)
}

/** One cursor per account id. Bounded: a window asks for a handful of keys, never thousands. */
const usageCursors = z.record(z.string().min(1), z.number().int().min(0))

export function parseUsageCursors(value: unknown): UsageCursors {
  return usageCursors.parse(value)
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

/** What a job runs, as the renderer names it — the same shape the manager submits. */
const jobTarget = z.object({ kind: z.enum(JOB_KINDS), id: z.string().trim().min(1) })

export function parseJobTarget(value: unknown): JobTarget {
  return jobTarget.parse(value)
}

const workflowId = z.string().trim().min(1)

export function parseWorkflowId(value: unknown): string {
  return workflowId.parse(value)
}

/**
 * A graph, on its way in to be compiled.
 *
 * Bounded like every other body that crosses: the renderer is sandboxed and trusted for nothing,
 * and a graph is the largest thing the studio sends this way. `data` is kept as it stands and
 * NOT validated — the same contract `parseGraph` holds on the other side, and the one the
 * converter is written against.
 */
const graphNode = z.object({
  id: z.string().min(1).max(GRAPH_ID_MAX),
  type: z.literal(GRAPH_NODE_TYPES),
  position: z.object({ x: z.number(), y: z.number() }),
  data: z.record(z.string(), z.unknown()),
})

const graphEdge = z.object({
  id: z.string().min(1).max(GRAPH_ID_MAX),
  source: z.string().min(1).max(GRAPH_ID_MAX),
  target: z.string().min(1).max(GRAPH_ID_MAX),
  sourceHandle: z.string().max(GRAPH_ID_MAX).optional(),
  targetHandle: z.string().max(GRAPH_ID_MAX).optional(),
})

const graphState = z.object({
  nodes: z.array(graphNode).max(GRAPH_NODES_MAX),
  edges: z.array(graphEdge).max(GRAPH_EDGES_MAX),
  inputKeys: z.array(z.string().max(GRAPH_ID_MAX)).max(GRAPH_NODES_MAX),
})

export function parseGraphState(value: unknown): GraphState {
  return graphState.parse(value)
}

/** Bounded like the model query: `limit` is the page the API is asked for, never a walk. */
const workflowQuery = z.object({
  privacy: z.enum(WORKFLOW_PRIVACIES).optional(),
  cursor: z.string().max(500).optional(),
  limit: z.number().int().min(1).max(100).optional(),
})

export function parseWorkflowQuery(value: unknown): WorkflowQuery {
  return value === undefined ? {} : workflowQuery.parse(value)
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

/**
 * Jobs read back from disk. Non-empty strings throughout: a hand-rolled guard once let a blank
 * pair through in the settings, and a blank `remoteId` here would poll a job id that is not one.
 *
 * An entry that does not parse is dropped rather than failing the read — a file the studio
 * cannot make sense of must not be a studio that will not start.
 */
const storedJob = z
  .object({
    id: z.string().trim().min(1),
    remoteId: z.string().trim().min(1),
    kind: z.enum(JOB_KINDS).catch('model'),
    targetId: z.string().trim().min(1).optional(),
    /** What `targetId` was called before workflows existed. Read, never written. */
    modelId: z.string().trim().min(1).optional(),
    label: z.string(),
    accountId: z.string().trim().min(1),
    projectPath: z.string().trim().min(1),
    createdAt: z.string().trim().min(1),
  })
  // A note written by an earlier version names a model and knows nothing of workflows. Dropping
  // it rather than reading it would abandon a generation that is running and already paid for.
  .transform(({ targetId, modelId, ...job }) => {
    const target = targetId ?? modelId
    return target === undefined ? null : { ...job, targetId: target }
  })

const storedJobs = z.array(storedJob.nullable().catch(null))

export function parseStoredJobs(content: string): PersistedJob[] {
  const parsed: unknown = JSON.parse(content)
  return storedJobs.parse(parsed).filter(job => job !== null)
}
