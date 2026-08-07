import { mdiCreationOutline } from '@mdi/js'
import { useQuery } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import type { ModelDescriptor } from '@shared/domain/model'
import { workspaceById } from '@/helpers/workspaces'
import type { FormValues } from '@/helpers/dynamic-form'
import { DynamicForm } from '@/design/DynamicForm'
import { failureKeyOf } from '@/services/failure-message'
import { getBridge } from '@/services/bridge'
import { useJobs } from '@/stores/jobs'
import { useLayouts } from '@/stores/layouts'
import { useModels } from '@/stores/models'
import { useProject } from '@/stores/project'
import { useSettings } from '@/stores/settings'
import { EmptyState } from '@/design/EmptyState'

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
  const family = workspaceById(workspace).family

  // The panel's choice wins over the preference: the preference is what to start from.
  const chosen = useModels(state => state.selected[family] ?? null)
  // Set by the inspector's "regenerate with these parameters"; ordinary generation leaves it
  // undefined and every field opens on its own default.
  const preset = useModels(state => state.preset[family])
  const preferred = useSettings(state => state.settings.generation.defaultModels[family] ?? null)
  const modelId = chosen ?? preferred

  const authenticated = useSettings(state => state.auth.authenticated)
  const project = useProject(state => state.project)
  const submit = useJobs(state => state.submit)

  const descriptor = useDescriptor(modelId)

  if (!authenticated) {
    return <EmptyState icon={mdiCreationOutline} message={t('generation.noCredentials')} />
  }

  if (!modelId) {
    return <EmptyState icon={mdiCreationOutline} message={t('generation.chooseModel')} />
  }

  if (descriptor.isPending) {
    return <EmptyState icon={mdiCreationOutline} message={t('collection.loading')} />
  }

  // A model can be withdrawn from the catalogue while it is still the chosen one. Without
  // this the panel renders an empty shell: no form, no reason, nothing to act on.
  if (descriptor.isError) {
    return <EmptyState icon={mdiCreationOutline} message={t(failureKeyOf(descriptor.error))} />
  }

  const generate = (body: FormValues): void => {
    void submit(modelId, body)
    // The preset belongs to the gesture that set it. Dropped once it has been generated from,
    // not when the form opens: clearing it earlier would reset the very fields it just filled.
    useModels.getState().consumePreset(family)
  }

  return (
    <div className="flex h-full flex-col overflow-auto">
      <p className="text-muted truncate px-2 pt-2 text-[11px]">{descriptor.data?.name}</p>

      {/* A project is where a generated asset lands; without one there is nowhere to put it. */}
      {!project && <p className="text-muted px-2 text-xs">{t('generation.noProject')}</p>}

      {descriptor.data && (
        <DynamicForm
          fields={descriptor.data.fields}
          onSubmit={generate}
          submitLabel={t('actions.generate')}
          busy={!project}
          preset={preset}
        />
      )}
    </div>
  )
}
