import {
  WORKFLOW_CACHE_MS,
  WORKFLOW_PRIVACIES,
  WORKFLOW_STATUSES,
  type WorkflowDescriptor,
  type WorkflowPage,
  type WorkflowPrivacy,
  type WorkflowQuery,
  type WorkflowStatus,
  type WorkflowSummary,
} from '@shared/domain/workflow'
import type { WatchCredentials } from './credentials-watch'
import { translateSchema, type ScenarioInput } from './schema'

/**
 * A workflow as the API returns it, reduced to what the studio reads. Narrower than the SDK
 * type on purpose: it is the whole contract with the outside world, and it is what lets the
 * registry be tested without a network.
 */
export type RemoteWorkflow = {
  id: string
  name?: string
  description?: string
  shortDescription?: string
  status?: string
  privacy?: string
  tagSet?: readonly string[]
  updatedAt?: string
  isLocked?: boolean
  thumbnail?: { url?: string }
  inputs?: readonly ScenarioInput[]
}

export type WorkflowListRequest = {
  privacy: WorkflowPrivacy
  pageSize: number
  token?: string
}

export type WorkflowCatalogPage = {
  workflows: readonly RemoteWorkflow[]
  /** Continuation for the same listing, or `null` when it is exhausted. */
  token: string | null
}

export type WorkflowCatalog = {
  list: (request: WorkflowListRequest) => Promise<WorkflowCatalogPage>
  retrieve: (workflowId: string) => Promise<{ workflow: RemoteWorkflow }>
}

export type WorkflowRegistry = {
  search: (query: WorkflowQuery) => Promise<WorkflowPage>
  describe: (workflowId: string) => Promise<WorkflowDescriptor>
}

export type WorkflowRegistryOptions = {
  catalog: () => WorkflowCatalog
  /** Required: everything cached here belongs to one account, and none of the keys say which. */
  watch: WatchCredentials
  ttlMs?: number
  now?: () => number
}

const DEFAULT_LIMIT = 24

/**
 * A status the studio does not know reads as `ready`, not as `draft`.
 *
 * Only an explicit `draft` blocks the Run button. The listing's spelling could not be observed —
 * no public workflow was reachable to check it — so refusing what we do not recognise would make
 * EVERY App inert if Scenario ever writes `published`. The same rule as an unknown field `kind`,
 * which falls back to a raw input rather than making the form disappear (invariant 5): the API
 * refuses what it must, and the studio does not hide a feature over a word.
 */
function statusOf(value: string | undefined): WorkflowStatus {
  return WORKFLOW_STATUSES.find(status => status === value) ?? 'ready'
}

/** Likewise the narrow answer: an unknown privacy is treated as the owner's own. */
function privacyOf(value: string | undefined): WorkflowPrivacy {
  return WORKFLOW_PRIVACIES.find(privacy => privacy === value) ?? 'private'
}

function summaryOf(workflow: RemoteWorkflow): WorkflowSummary {
  const summary: WorkflowSummary = {
    id: workflow.id,
    // An unnamed workflow is still runnable; showing its id beats showing nothing.
    name: workflow.name ?? workflow.id,
    status: statusOf(workflow.status),
    privacy: privacyOf(workflow.privacy),
    tags: [...(workflow.tagSet ?? [])],
  }

  // The short one is what the API writes for a card; the long one is a fallback, not a second
  // field — the panel has one line for it either way. Emptiness rather than absence: the SDK
  // types `shortDescription` as required, so an author who filled only the long one sends `''`,
  // which `??` would hand straight through.
  const description = workflow.shortDescription || workflow.description
  if (description) summary.description = description
  if (workflow.thumbnail?.url) summary.thumbnail = workflow.thumbnail.url
  if (workflow.updatedAt) summary.updatedAt = workflow.updatedAt
  if (workflow.isLocked === true) summary.locked = true

  return summary
}

type Cached<T> = { at: number; value: T }

/**
 * Serves the workflow listing one page at a time and caches what it has walked.
 *
 * Cached for the reason the model catalogue is: an App's definition changes at Scenario's pace,
 * not at ours, and a panel that re-listed on every remount would spend the interactive share of
 * the rate budget on data that is stable for hours.
 */
export function createWorkflowRegistry({
  catalog,
  watch,
  ttlMs = WORKFLOW_CACHE_MS,
  now = Date.now,
}: WorkflowRegistryOptions): WorkflowRegistry {
  const pages = new Map<string, Cached<WorkflowPage>>()
  const descriptors = new Map<string, Cached<WorkflowDescriptor>>()

  const fresh = <T>(entry: Cached<T> | undefined): T | null =>
    entry && now() - entry.at < ttlMs ? entry.value : null

  watch(() => {
    pages.clear()
    descriptors.clear()
  })

  return {
    search: async query => {
      const key = JSON.stringify(query)
      const cached = fresh(pages.get(key))
      if (cached) return cached

      const page = await catalog().list({
        privacy: query.privacy ?? 'public',
        pageSize: query.limit ?? DEFAULT_LIMIT,
        ...(query.cursor ? { token: query.cursor } : {}),
      })

      const value: WorkflowPage = { items: page.workflows.map(summaryOf), cursor: page.token }
      pages.set(key, { at: now(), value })
      return value
    },

    describe: async workflowId => {
      const cached = fresh(descriptors.get(workflowId))
      if (cached) return cached

      const { workflow } = await catalog().retrieve(workflowId)
      // The very same translation a model's inputs go through: the two schemas have one shape,
      // and a second translator would be a second set of gaps — see invariant 5.
      const descriptor: WorkflowDescriptor = {
        ...summaryOf(workflow),
        fields: translateSchema(workflow.inputs),
      }

      descriptors.set(workflowId, { at: now(), value: descriptor })
      return descriptor
    },
  }
}
