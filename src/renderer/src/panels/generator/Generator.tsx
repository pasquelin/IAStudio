import { mdiCreationOutline } from '@mdi/js'
import { useQuery } from '@tanstack/react-query'
import { Suspense, useCallback, useEffect, useRef } from 'react'
import { useTranslation } from 'react-i18next'
import type { Job } from '@shared/domain/job'
import type { ModelDescriptor } from '@shared/domain/model'
import { isBeyondPlan } from '@shared/domain/plan'
import { useModelForFamily } from '@/helpers/model-for-family'
import { usePlanAccess } from '@/helpers/plan-access'
import { workspaceById } from '@/helpers/workspaces'
import { referencePictures, type FormValues } from '@/helpers/dynamic-form'
import { registerGenerator } from '@/assistant/generator-bridge'
import { dictationAccessory } from '@/dictation/DictationField'
import { failureKeyOf } from '@/services/failure-message'
import { getBridge } from '@/services/bridge'
import { useJobs } from '@/stores/jobs'
import { useLayouts } from '@/stores/layouts'
import { useModels } from '@/stores/models'
import { useProject } from '@/stores/project'
import { claimOnSubmit } from '@/stores/generation-claims'
import { useSettings } from '@/stores/settings'
import { DynamicForm } from '@/design/dynamic-form-lazy'
import { FormHeader } from '@/design/FormHeader'
import { EmptyState } from '@/design/EmptyState'
import { ErrorBoundary } from '@/design/ErrorBoundary'
import { MissingCredentials } from '@/panels/shared/MissingCredentials'
import { NoProject } from '@/panels/shared/NoProject'
import { useCostEstimate } from '@/hooks/useCostEstimate'

function useDescriptor(modelId: string | null) {
  return useQuery<ModelDescriptor | null>({
    queryKey: ['model', modelId],
    queryFn: () =>
      modelId ? (getBridge()?.scenario.describeModel(modelId) ?? null) : Promise.resolve(null),
    enabled: modelId !== null,
  })
}

/**
 * The form the chosen model's schema describes, and nothing else: the prompt, the parameters,
 * the button. Which model runs is the Models panel's business — see spec § 6, and no field
 * here is written for any particular model.
 */
export function Generator() {
  const { t } = useTranslation()

  const workspace = useLayouts(state => state.activeWorkspace)

  // What an edit asked this generator to open on — an upscaler for Enlarge — or the workspace's
  // own family. See `prepared`: it is a parenthesis, and it closes on its own.
  const prepared = useModels(state => state.prepared)
  const family = prepared ?? workspaceById(workspace).family

  // Set by the inspector's "regenerate with these parameters"; ordinary generation leaves it
  // undefined and every field opens on its own default.
  //
  // It is deliberately not cleared once used: `DynamicForm` rebuilds its defaults whenever the
  // preset changes, so dropping it would blank the form under the hand that is filling it. It
  // stays until the next "regenerate" replaces it, which reads as the last settings used.
  const preset = useModels(state => state.preset[family])
  const modelId = useModelForFamily(family)

  const authenticated = useSettings(state => state.auth.authenticated)
  const project = useProject(state => state.project)
  const submit = useJobs(state => state.submit)

  const descriptor = useDescriptor(modelId)
  // Before the guards below return early: a hook cannot be called conditionally.
  const cost = useCostEstimate(modelId, descriptor.data?.fields)
  const plan = usePlanAccess()

  /**
   * The body as the form stands, kept for whoever asks from outside — today the assistant, which
   * has to see what would be sent before it may quote a cost and ask for a yes.
   *
   * A ref rather than state: this changes on every keystroke, and the panel has no reason to
   * re-render because something that is not on screen wants to read it. `useCostEstimate`
   * subscribes to the same feed for the same reason.
   */
  const body = useRef<FormValues>({})

  /**
   * Runs the generation and answers the job, which the button's own handler discards.
   *
   * The claim is part of it, not around it: which workspace has somewhere to put the result is
   * settled at the click, and a second path that skipped it would land generations nowhere.
   */
  const runGeneration = useCallback(
    (values: FormValues): Promise<Job | null> => {
      if (!modelId) return Promise.resolve(null)
      const claim = claimOnSubmit()
      return submit({ id: modelId }, values).then(job => {
        claim(job)
        return job
      })
    },
    [modelId, submit],
  )

  useEffect(
    () =>
      registerGenerator({
        body: () => (modelId ? { modelId, values: body.current } : null),
        submit: () => runGeneration(body.current),
        // Which fields hold a picture is a fact of the model's schema, and this panel is the
        // only place that has it — see `GeneratorBridge`.
        references: () => referencePictures(descriptor.data?.fields ?? [], body.current),
      }),
    [modelId, runGeneration, descriptor.data],
  )

  const watchValues = cost.onValuesChange
  const onValuesChange = useCallback(
    (values: FormValues) => {
      body.current = values
      watchValues(values)
    },
    [watchValues],
  )

  /**
   * The last door before the spend, for everything that arms a model without opening the picker:
   * a stored default, "recreate", "regenerate with these parameters", a Spark idea and the canvas
   * edits all land here. Greying the picker alone would leave every one of them to discover the
   * 403.
   */
  const refused = plan !== null && isBeyondPlan(descriptor.data?.requiredPlanLevel, plan)

  if (!authenticated) return <MissingCredentials icon={mdiCreationOutline} />

  // A job collects into its own project and nowhere else, so generating without one produces
  // assets that land nowhere. The panel asks for a project rather than drawing a form whose
  // button is dead — which is what it did, with one muted line to say why.
  if (!project) return <NoProject icon={mdiCreationOutline} message={t('generation.noProject')} />

  // Unreachable: a section without a model offers no generator at all — the rail drops its icon
  // and `shownTool` puts Models in this half. The guard is what makes `modelId` a string below.
  if (!modelId) return null

  if (descriptor.isPending) {
    return <EmptyState icon={mdiCreationOutline} message={t('collection.loading')} />
  }

  // A model can be withdrawn from the catalogue while it is still the chosen one. Without
  // this the panel renders an empty shell: no form, no reason, nothing to act on.
  if (descriptor.isError) {
    return <EmptyState icon={mdiCreationOutline} message={t(failureKeyOf(descriptor.error))} />
  }

  // Claimed at the click and settled when the job id arrives: which workspace has somewhere to
  // put a result is not this panel's business — it serves every one of them.
  const generate = (values: FormValues): void => void runGeneration(values)

  return (
    <div className="flex h-full min-h-0 flex-col overflow-auto">
      <FormHeader title={descriptor.data?.name ?? t('collection.loading')} />

      {/* Refused by the subscription, not by the studio — saying so beats a 403 nobody reads. */}
      {refused && (
        <p className="text-muted px-2 text-xs">{t('models.planLockedHint', { plan: plan.name })}</p>
      )}

      {/* Gated on the descriptor, which is what makes the deferred form free to the eye: it only
          renders once that round trip has come back, so the wait its chunk adds sits inside one
          the panel already had. */}
      {descriptor.data && (
        // Above the `Suspense`: a rejected `lazy()` import is an error, not a fallback. Without
        // it the throw leaves the panel, leaves the dock, and takes the whole window down.
        <ErrorBoundary>
          <Suspense
            fallback={<EmptyState icon={mdiCreationOutline} message={t('collection.loading')} />}
          >
            <DynamicForm
              fields={descriptor.data.fields}
              onSubmit={generate}
              submitLabel={t('actions.generate')}
              submitHint={t('actions.generateHint')}
              submitNote={cost.note}
              onValuesChange={onValuesChange}
              // `project` is not in this: the panel returns before the form when there is none.
              busy={refused}
              preset={preset}
              // Dictation alone now. Rewriting a prompt, translating it and reading the style of
              // the references left this panel for the assistant: they are things one ASKS for,
              // and three buttons under a field could only ever offer three of them.
              accessory={field => dictationAccessory(field)}
            />
          </Suspense>
        </ErrorBoundary>
      )}
    </div>
  )
}
