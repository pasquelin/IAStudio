import { mdiTuneVariant } from '@mdi/js'
import { Suspense, lazy, useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import type { GraphNode, GraphState } from '@shared/domain/graph'
import type { FieldDescriptor, ModelDescriptor, ModelPage } from '@shared/domain/model'
import { isBeyondPlan } from '@shared/domain/plan'
import { EmptyState } from '@/design/EmptyState'
import { ErrorBoundary } from '@/design/ErrorBoundary'
import { PropertyGroup } from '@/design/PropertyGroup'
import { PropertyRow } from '@/design/PropertyRow'
import { CONTROL } from '@/design/styles'
import { setGraphNodeData, setGraphNodeModel } from '@/engines/graph/commands'
import { modelDataOf } from '@/engines/graph/factory'
import { cn } from '@/helpers/cn'
import { usePlanAccess } from '@/helpers/plan-access'
import type { FormValues } from '@/helpers/dynamic-form'
import { getBridge } from '@/services/bridge'
import { reportFailure } from '@/services/diagnostics'
import { useGraphs } from '@/stores/graphs'
import type { DocumentEdit } from './useDocumentEdit'

/**
 * How many models the picker offers. One page rather than the whole catalogue: a native select is
 * the OS list, searchable by keystroke, and six hundred rows in one would be a menu to scroll
 * rather than a choice.
 */
const PICKER_LIMIT = 60

/**
 * Lazy, as the generator and the Apps panel load it. It drags `zod` and `react-hook-form` behind
 * it — 220 kB measured — and the inspector is placed in EVERY workspace, so a static import would
 * make a 3D session pay for a form it will never render.
 */
const DynamicForm = lazy(async () => ({
  default: (await import('@/design/DynamicForm')).DynamicForm,
}))

export type ModelNodeFieldsProps = {
  documentId: string
  node: GraphNode
  edit: DocumentEdit<GraphState>
}

/**
 * What a generator node runs, and the parameters it runs it with.
 *
 * Neither is written by hand: the form comes from the model's own schema, and so do the node's
 * PORTS (invariant 5) — which is why changing the model is ONE command that swaps both and cuts
 * the edges the departing ports answered for.
 */
export function ModelNodeFields({ documentId, node, edit }: ModelNodeFieldsProps) {
  const { t } = useTranslation()
  const modelId = node.type === 'model' ? node.data.modelId : undefined
  const plan = usePlanAccess()

  const schema = useQuery<ModelDescriptor | null>({
    queryKey: ['model', modelId],
    queryFn: () =>
      modelId ? (getBridge()?.scenario.describeModel(modelId) ?? null) : Promise.resolve(null),
    enabled: modelId !== undefined,
  })

  // The family comes from the model the node holds, never guessed from its id: the id spells the
  // family it was CREATED for, and a node whose model has since been swapped would lie about it.
  const family = schema.data?.family

  /**
   * Held until the schema has said which family this is. Fired straight away, it answered with
   * EVERY family for as long as `describeModel` took — and a model of another family chosen in
   * that window renames the output port, which silently cuts every edge reading this node.
   */
  const catalogue = useQuery<ModelPage>({
    queryKey: ['models', 'picker', family ?? 'all'],
    queryFn: () =>
      getBridge()?.scenario.searchModels({
        limit: PICKER_LIMIT,
        ...(family ? { family } : {}),
      }) ?? Promise.resolve({ items: [], cursor: null }),
    enabled: modelId === undefined || family !== undefined,
  })

  /** The chosen model among them whatever the page says, so a node never loses the model it runs. */
  const options = useMemo(() => {
    const items = catalogue.data?.items ?? []
    if (!modelId || items.some(model => model.id === modelId)) return items
    // The grade comes along: `describeModel` retrieves it, and without it the one model the node
    // actually runs would be the only row the plan never checks.
    return [
      {
        id: modelId,
        name: schema.data?.name ?? modelId,
        requiredPlanLevel: schema.data?.requiredPlanLevel,
      },
      ...items,
    ]
  }, [catalogue.data, modelId, schema.data])

  const swap = (next: string): void => {
    void getBridge()
      ?.scenario.describeModel(next)
      .then(descriptor => {
        if (!descriptor) return
        // What the user typed survives every key the NEW model still declares — `defaultValues`
        // takes a preset for exactly this, and a prompt written into one model is a prompt.
        const kept = node.type === 'model' ? node.data.form : undefined
        edit.run(setGraphNodeModel(node.id, modelDataOf(node.id, descriptor, kept)))
      })
      // As the palette's own `describeModel` does: offline, the select springs back to the old
      // value on its own, and without this nothing anywhere says why.
      .catch(error => reportFailure('graph.node', next, error))
  }

  return (
    <>
      <PropertyRow label={t('inspector.model')}>
        {/* A native select, as the blend row uses one: the OS list is searchable by keystroke,
            which a flyout of sixty rows is not. */}
        <select
          aria-label={t('inspector.model')}
          value={modelId ?? ''}
          onChange={event => swap(event.target.value)}
          className={cn(CONTROL, 'w-full px-1')}
        >
          {/* A node read off a file may carry no model at all. Without this row the browser falls
              back to the first option, so the panel names a model the node does not run — and
              that one model is then the only one clicking cannot choose. */}
          {modelId === undefined && <option value="">{t('inspector.noModel')}</option>}
          {options.map(model => {
            // A graph runs its nodes itself — `graph-runs.ts` submits straight to the job queue,
            // never through the generator — so this is where a refused model has to be caught.
            // Without it, a five-node graph pays for the first three and dies on the fourth.
            const refused = isBeyondPlan(model.requiredPlanLevel, plan)
            return (
              <option key={model.id} value={model.id} disabled={refused}>
                {refused ? `${model.name} — ${t('models.planLocked')}` : model.name}
              </option>
            )
          })}
        </select>
      </PropertyRow>

      {schema.data && (
        <NodeForm
          // Remounted when the node or its model changes, never when a value does: the form opens
          // on what the node holds, and re-seeding it per keystroke would move the caret.
          key={`${node.id}:${modelId ?? ''}`}
          documentId={documentId}
          node={node}
          fields={schema.data.fields}
          edit={edit}
        />
      )}
    </>
  )
}

function NodeForm({
  documentId,
  node,
  fields,
  edit,
}: {
  documentId: string
  node: GraphNode
  fields: readonly FieldDescriptor[]
  edit: DocumentEdit<GraphState>
}) {
  const { t } = useTranslation()

  /**
   * Captured once. `preset` reseeds the form when its identity changes, and what the node holds
   * changes identity on every keystroke this very form causes — read live, the caret would jump
   * back on each letter.
   */
  const [opened] = useState<FormValues>(() => (node.type === 'model' ? { ...node.data.form } : {}))

  // Both memoised because `DynamicForm` re-subscribes when either changes identity, and every
  // subscription reports the body once — a new array or a new closure per render would therefore
  // write to the history on every render.
  const list = useMemo(() => [...fields], [fields])

  /**
   * The first report is swallowed, and every one after it is written inside ONE gesture.
   *
   * Swallowed because subscribing reports the body once: written, opening the panel would sit in
   * the undo history, and a model swap would leave TWO entries — `⌘Z` then gave back the previous
   * model's values ON the new model instead of undoing the swap whole.
   *
   * Inside a gesture because `DynamicForm` reports per keystroke and has no focus/blur to hang
   * one on, unlike the `TextField`s above. Without it a typed prompt of 120 characters is 120
   * entries, and `HISTORY_LIMIT` is 100: the nodes and the wires that came before are evicted by
   * the sentence describing them.
   */
  const opening = useRef(true)
  const editing = useRef(false)
  const write = useCallback(
    (form: FormValues) => {
      if (opening.current) {
        opening.current = false
        return
      }
      if (!editing.current) {
        useGraphs.getState().beginGesture(documentId)
        editing.current = true
      }
      edit.run(setGraphNodeData(node.id, { form }))
    },
    [documentId, edit, node.id],
  )

  // Closed when this form goes — the panel shut, another node picked, the model swapped. A gesture
  // left open would swallow every later edit of the document into the entry this form began.
  useEffect(
    () => () => {
      if (editing.current) useGraphs.getState().endGesture(documentId)
    },
    [documentId],
  )

  return (
    // The form is its own group: it carries a layout of its own, and dropped among the property
    // rows above it breaks the label column they line up on.
    <PropertyGroup title={t('inspector.generation')}>
      {/* Above the `Suspense`, as the generator has it: a rejected `lazy()` import is an error,
          not a fallback, and the throw would take the whole panel down. */}
      <ErrorBoundary>
        <Suspense fallback={<EmptyState icon={mdiTuneVariant} message={t('collection.loading')} />}>
          <DynamicForm fields={list} preset={opened} onValuesChange={write} />
        </Suspense>
      </ErrorBoundary>
    </PropertyGroup>
  )
}
