import { mdiApplicationBracesOutline, mdiArrowLeft } from '@mdi/js'
import { useInfiniteQuery, useQuery } from '@tanstack/react-query'
import { lazy, memo, Suspense, useCallback, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import {
  isRunnable,
  WORKFLOW_CACHE_MS,
  type WorkflowDescriptor,
  type WorkflowPage,
  type WorkflowSummary,
} from '@shared/domain/workflow'
import type { FormValues } from '@/helpers/dynamic-form'
import { dictationAccessory } from '@/dictation/DictationField'
import { Collection } from '@/design/Collection'
import { EmptyState } from '@/design/EmptyState'
import { ErrorBoundary } from '@/design/ErrorBoundary'
import { Row } from '@/design/Row'
import { Thumbnail } from '@/design/Thumbnail'
import { ToolButton } from '@/design/ToolButton'
import { failureKeyOf } from '@/services/failure-message'
import { getBridge } from '@/services/bridge'
import { claimOnSubmit } from '@/stores/generation-claims'
import { useJobs } from '@/stores/jobs'
import { useProject } from '@/stores/project'
import { useSettings } from '@/stores/settings'
import { MissingCredentials } from '@/panels/shared/MissingCredentials'
import { useCostEstimate } from '@/hooks/useCostEstimate'

/** Deferred for the reason the generator defers it: the form drags zod and its resolver along. */
const DynamicForm = lazy(async () => ({
  default: (await import('@/design/DynamicForm')).DynamicForm,
}))

/**
 * The API's own maximum. The panel pulls the next page as the end of the list nears, so a small
 * page is a request per screenful of a listing that is stable for hours — and the interactive
 * share of the rate budget is fifteen requests a minute for everything the user waits on.
 */
const PAGE_LIMIT = 100
/** A thumbnail, a name and what the App does: two lines beside a 32 px picture. */
const ROW_HEIGHT = 40

function searchApps(cursor?: string): Promise<WorkflowPage> {
  const bridge = getBridge()
  if (!bridge) return Promise.resolve({ items: [], cursor: null })

  // Public and nothing else: those are the Apps. A private workflow belongs to the account that
  // wrote it, and the studio has no editor for one yet — that is the node editor's business.
  return bridge.workflows.search({ privacy: 'public', limit: PAGE_LIMIT, cursor })
}

/**
 * Scenario's Apps: public workflows, run as they are.
 *
 * A pipeline of several models behind one form — the ready-made half of the platform, which the
 * studio had none of. Running one goes through the very same job manager a generation does, so
 * it lands in the jobs bar and its outputs in the open project like everything else.
 */
export function Apps() {
  const { t } = useTranslation()
  const authenticated = useSettings(state => state.auth.authenticated)
  const [openedId, setOpenedId] = useState<string | null>(null)

  const listing = useInfiniteQuery<WorkflowPage>({
    queryKey: ['workflows', 'public'],
    queryFn: ({ pageParam }) => searchApps(typeof pageParam === 'string' ? pageParam : undefined),
    getNextPageParam: page => page.cursor ?? undefined,
    initialPageParam: undefined,
    enabled: authenticated,
    // As long as the registry caches its pages: a remount — a dock tab, a detached panel — would
    // otherwise replay every page loaded so far through the boundary for nothing.
    staleTime: WORKFLOW_CACHE_MS,
  })

  const items = useMemo(() => {
    const unique = new Map<string, WorkflowSummary>()
    for (const page of listing.data?.pages ?? []) {
      for (const app of page.items) if (!unique.has(app.id)) unique.set(app.id, app)
    }
    return [...unique.values()]
  }, [listing.data])

  const { hasNextPage, isFetchingNextPage, fetchNextPage } = listing
  const loadMore = useCallback(() => {
    if (hasNextPage && !isFetchingNextPage) void fetchNextPage()
  }, [hasNextPage, isFetchingNextPage, fetchNextPage])

  if (!authenticated) return <MissingCredentials icon={mdiApplicationBracesOutline} />

  if (openedId) return <AppRunner workflowId={openedId} onBack={() => setOpenedId(null)} />

  // Without this the panel sits on "loading" for ever when the API refuses the request.
  if (listing.isError) {
    return (
      <EmptyState icon={mdiApplicationBracesOutline} message={t(failureKeyOf(listing.error))} />
    )
  }

  return (
    <Collection
      label={t('panels.apps')}
      items={items}
      onSelect={app => setOpenedId(app.id)}
      onReachEnd={loadMore}
      rowHeight={ROW_HEIGHT}
      renderRow={app => <AppRow app={app} />}
      empty={
        <EmptyState
          icon={mdiApplicationBracesOutline}
          message={listing.isFetching ? t('collection.loading') : t('apps.none')}
        />
      }
      footer={
        listing.isFetchingNextPage ? (
          <p className="text-muted py-2 text-center text-[11px]">{t('collection.loading')}</p>
        ) : null
      }
    />
  )
}

/** Memoized like the model rows: a scroll re-renders every mounted row on each frame. */
const AppRow = memo(function AppRow({ app }: { app: WorkflowSummary }) {
  return (
    <Row
      media={<Thumbnail url={app.thumbnail} className="size-8" />}
      title={app.name}
      subtitle={app.description ?? app.tags.join(' · ')}
    />
  )
})

/**
 * One App, and the form its inputs describe. The form is not written here any more than a
 * model's is — the inputs of a workflow have the very same shape, so the same descriptors and
 * the same `DynamicForm` render both (invariant 5).
 */
function AppRunner({ workflowId, onBack }: { workflowId: string; onBack: () => void }) {
  const { t } = useTranslation()
  const project = useProject(state => state.project)
  const submit = useJobs(state => state.submit)

  const descriptor = useQuery<WorkflowDescriptor | null>({
    queryKey: ['workflow', workflowId],
    queryFn: () => getBridge()?.workflows.describe(workflowId) ?? null,
  })

  const app = descriptor.data ?? null
  // Before the guards below: a hook cannot be called conditionally.
  const cost = useCostEstimate('workflow', workflowId, app?.fields)

  const start = (body: FormValues): void => {
    const claim = claimOnSubmit()
    void submit({ kind: 'workflow', id: workflowId }, body).then(claim)
  }

  return (
    <div className="flex h-full min-h-0 flex-col overflow-auto">
      <div className="border-border flex items-center gap-2 border-b px-1 py-1.5">
        <ToolButton icon={mdiArrowLeft} label={t('apps.back')} onClick={onBack} />
        <p className="truncate text-[11px]">{app?.name ?? t('collection.loading')}</p>
      </div>

      {!project && <p className="text-muted px-2 pt-2 text-xs">{t('generation.noProject')}</p>}

      {descriptor.isError && (
        <EmptyState
          icon={mdiApplicationBracesOutline}
          message={t(failureKeyOf(descriptor.error))}
        />
      )}

      {/* A draft is refused by the API, not by the studio — saying so beats a 400 nobody reads. */}
      {app && !isRunnable(app) && <p className="text-muted px-2 pt-2 text-xs">{t('apps.draft')}</p>}

      {app && (
        // Above the `Suspense`: a rejected `lazy()` import is an error, not a fallback.
        <ErrorBoundary>
          <Suspense
            fallback={
              <EmptyState icon={mdiApplicationBracesOutline} message={t('collection.loading')} />
            }
          >
            <DynamicForm
              fields={app.fields}
              onSubmit={start}
              submitLabel={t('apps.run')}
              submitNote={cost.note}
              onValuesChange={cost.onValuesChange}
              busy={!project || !isRunnable(app)}
              accessory={dictationAccessory}
            />
          </Suspense>
        </ErrorBoundary>
      )}
    </div>
  )
}
