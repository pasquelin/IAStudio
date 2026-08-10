import type { GraphTransformVariables } from '@shared/domain/graph'

/** One CEL evaluation asked of the thread. `id` pairs it with its answer. */
export type TransformRequest = {
  id: number
  expression: string
  variables: GraphTransformVariables
}

/**
 * What the thread answers. Already normalised to the values a wire carries: nothing exotic —
 * a `bigint`, a CEL map — ever crosses back, so the boundary carries strings and a reason.
 */
export type TransformResponse =
  { id: number; ok: true; values: readonly string[] } | { id: number; ok: false; reason: string }

/** What an evaluation answers, thread or not. The reason goes to the journal, never to a screen. */
export type TransformVerdict =
  { ok: true; values: readonly string[] } | { ok: false; reason: string }
