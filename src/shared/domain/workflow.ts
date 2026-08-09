/**
 * A Scenario workflow — a pipeline of nodes, run as one job.
 *
 * A public one is an **App**: discoverable and runnable by anyone, which is what makes them a
 * ready-made library the studio can offer without a single graph being drawn.
 *
 * Its `inputs` have the very same shape as a model's, so they translate into `FieldDescriptor`
 * through `translateSchema` and render through `DynamicForm` — invariant 5 covers both.
 */
import type { FieldDescriptor } from './model'

/** `draft` cannot be run; `deleted` is a soft delete, which a listing does not return. */
export type WorkflowStatus = 'draft' | 'ready' | 'deleted'

export type WorkflowPrivacy = 'private' | 'public' | 'unlisted'

export const WORKFLOW_STATUSES: readonly WorkflowStatus[] = ['draft', 'ready', 'deleted']

export const WORKFLOW_PRIVACIES: readonly WorkflowPrivacy[] = ['private', 'public', 'unlisted']

export type WorkflowSummary = {
  id: string
  name: string
  /** One line, from `shortDescription` and falling back to the long one. */
  description?: string
  status: WorkflowStatus
  privacy: WorkflowPrivacy
  tags: string[]
  /** Signed picture URL. The API says it is the "after" asset of the before/after pair. */
  thumbnail?: string
  updatedAt?: string
  /**
   * Whether its author sealed it. Honoured in the interface rather than discovered as a 403 —
   * a locked workflow refuses every edit and every delete but runs like any other.
   */
  locked?: boolean
}

/** A workflow with the form its inputs describe — the shape the run panel needs. */
export type WorkflowDescriptor = WorkflowSummary & { fields: FieldDescriptor[] }

export type WorkflowQuery = {
  privacy?: WorkflowPrivacy
  /** Opaque: hand back what the previous page answered. */
  cursor?: string
  limit?: number
}

export type WorkflowPage = {
  items: WorkflowSummary[]
  /** `null` once the listing is exhausted. */
  cursor: string | null
}

/**
 * How long a listing is worth keeping.
 *
 * Shared because both sides cache it and neither can see the other: the main process holds the
 * pages it walked, the renderer holds the query that asked for them. Two numbers would mean the
 * window asking again for what the registry answers from memory.
 */
export const WORKFLOW_CACHE_MS = 10 * 60 * 1000

/** Only a `ready` workflow can be run — `draft` answers 400, and it is the API that decides. */
export function isRunnable(workflow: WorkflowSummary): boolean {
  return workflow.status === 'ready'
}
