import { mdiCreationOutline } from '@mdi/js'
import { useQuery } from '@tanstack/react-query'
import { lazy, Suspense } from 'react'
import { useTranslation } from 'react-i18next'
import { formatUnits } from '@/usage/format'
import type { ModelDescriptor } from '@shared/domain/model'
import type { PromptStyle, PromptSuggestion, PromptTranslation } from '@shared/domain/prompt-assist'
import { workspaceById } from '@/helpers/workspaces'
import { referencePictures, type FormValues } from '@/helpers/dynamic-form'
import { PromptAssistant } from '@/design/PromptAssistant'
import { failureKeyOf } from '@/services/failure-message'
import { getBridge } from '@/services/bridge'
import { useJobs } from '@/stores/jobs'
import { useLayouts } from '@/stores/layouts'
import { useModels } from '@/stores/models'
import { useProject } from '@/stores/project'
import { claimOnSubmit } from '@/stores/generation-claims'
import { useSettings } from '@/stores/settings'
import { EmptyState } from '@/design/EmptyState'
import { ErrorBoundary } from '@/design/ErrorBoundary'
import { MissingCredentials } from '@/panels/shared/MissingCredentials'
import { useCostEstimate } from './useCostEstimate'

/**
 * Deferred on purpose: the form drags zod, react-hook-form and its resolver behind it, and
 * taking them out of the opening chunk measured −219,62 kB on 8 August. It only renders once
 * the model descriptor has come back, so the wait it adds sits inside one the panel already had.
 */
const DynamicForm = lazy(async () => ({
  default: (await import('@/design/DynamicForm')).DynamicForm,
}))

/**
 * Free — measured at 0 creative units — and answered in one round trip, so no job is involved
 * and there is nothing for the jobs bar to show.
 */
function suggestPrompts(modelId: string, draft: string): Promise<PromptSuggestion[]> {
  const bridge = getBridge()
  if (!bridge) return Promise.resolve([])
  return bridge.scenario.suggestPrompts({ modelId, prompt: draft })
}

/** A field's value as text. Anything else reads as an empty draft rather than as `[object …]`. */
function textOf(value: unknown): string {
  return typeof value === 'string' ? value : ''
}

/** Carries a draft into the language the models read. Nothing is proposed: the text changes. */
function translateDraft(draft: string): Promise<PromptTranslation> {
  const bridge = getBridge()
  if (!bridge) return Promise.resolve({ text: draft, detectedLanguage: 'english' })
  return bridge.scenario.translatePrompt(draft)
}

/** Reads the style of the pictures already on the form, to write a prompt from it. */
function describeStyle(images: readonly string[]): Promise<PromptStyle> {
  const bridge = getBridge()
  if (!bridge) return Promise.resolve({ description: '', synthesis: '' })
  return bridge.scenario.describeStyle(images)
}

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
  const { t, i18n } = useTranslation()

  const workspace = useLayouts(state => state.activeWorkspace)

  // What an edit asked this generator to open on — an upscaler for Enlarge — or the workspace's
  // own family. See `prepared`: it is a parenthesis, and it closes on its own.
  const prepared = useModels(state => state.prepared)
  const family = prepared ?? workspaceById(workspace).family

  // The panel's choice wins over the preference: the preference is what to start from.
  const chosen = useModels(state => state.selected[family] ?? null)
  // Set by the inspector's "regenerate with these parameters"; ordinary generation leaves it
  // undefined and every field opens on its own default.
  //
  // It is deliberately not cleared once used: `DynamicForm` rebuilds its defaults whenever the
  // preset changes, so dropping it would blank the form under the hand that is filling it. It
  // stays until the next "regenerate" replaces it, which reads as the last settings used.
  const preset = useModels(state => state.preset[family])
  const prepare = useModels(state => state.prepare)
  const preferred = useSettings(state => state.settings.generation.defaultModels[family] ?? null)
  const modelId = chosen ?? preferred

  const authenticated = useSettings(state => state.auth.authenticated)
  const project = useProject(state => state.project)
  const submit = useJobs(state => state.submit)

  const descriptor = useDescriptor(modelId)
  // Before the guards below return early: a hook cannot be called conditionally.
  const cost = useCostEstimate(modelId, descriptor.data?.fields)

  if (!authenticated) return <MissingCredentials icon={mdiCreationOutline} />

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
  const generate = (body: FormValues): void => {
    const claim = claimOnSubmit()
    void submit(modelId, body).then(claim)
  }

  // Adopting the settings goes through the preset "regenerate with these parameters" already
  // uses: `DynamicForm` rebuilds on it, so the whole form fills without a line of its own. The
  // model is passed unchanged — `prepare` writes both, and the suggestion was made for it.
  const adoptCall = (promptKey: string, suggestion: PromptSuggestion): void => {
    prepare(family, modelId, { ...suggestion.parameters, [promptKey]: suggestion.text })
  }

  return (
    <div className="flex h-full flex-col overflow-auto">
      <p className="text-muted truncate px-2 pt-2 text-[11px]">{descriptor.data?.name}</p>

      {/* A project is where a generated asset lands; without one there is nowhere to put it. */}
      {!project && <p className="text-muted px-2 text-xs">{t('generation.noProject')}</p>}

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
              // Absent rather than zero when nothing is priced: a button that says nothing is
              // honest, one that says « 0 CU » would be wrong about a generation that costs.
              submitNote={
                cost.estimate
                  ? t('generation.estimatedCost', {
                      // The same formatter the usage window reads its figures with: the API
                      // prices a cheap call in fractions, and `String(1/3)` is sixteen digits.
                      units: formatUnits(cost.estimate.creativeUnits, i18n.language),
                    })
                  : undefined
              }
              onValuesChange={cost.onValuesChange}
              busy={!project}
              preset={preset}
              // The API marks the field its assistance rewrites; every other one gets nothing.
              accessory={(field, handle) =>
                field.promptSpark === true && (
                  <PromptAssistant
                    readDraft={() => textOf(handle.read())}
                    request={draft => suggestPrompts(modelId, draft)}
                    translate={translateDraft}
                    describeStyle={describeStyle}
                    readReferences={() =>
                      referencePictures(descriptor.data?.fields ?? [], handle.readAll())
                    }
                    onAdoptText={handle.write}
                    onAdoptCall={suggestion => adoptCall(field.key, suggestion)}
                    failureMessage={error => t(failureKeyOf(error))}
                  />
                )
              }
            />
          </Suspense>
        </ErrorBoundary>
      )}
    </div>
  )
}
