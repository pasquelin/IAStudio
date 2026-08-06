import { mdiCreationOutline } from '@mdi/js'
import { useQuery } from '@tanstack/react-query'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import type { ModelDescriptor, ModelSummary } from '@shared/domain/model'
import type { FormValues } from '@/design/dynamic-form'
import { DynamicForm } from '@/design/DynamicForm'
import { getBridge } from '@/services/bridge'
import { useJobs } from '@/stores/jobs'
import { useProject } from '@/stores/project'
import { useSettings } from '@/stores/settings'
import { EmptyState } from './EmptyState'

function useModels(enabled: boolean) {
  return useQuery<ModelSummary[]>({
    queryKey: ['models'],
    queryFn: () => getBridge()?.scenario.listModels() ?? Promise.resolve([]),
    enabled,
  })
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
 * Model picker plus the form its schema describes. Nothing about any particular model lives
 * here: the fields come from `GET /models/{id}`, translated by the registry — see spec § 6.
 */
export function Generator() {
  const { t } = useTranslation()

  // The generator serves the Image workspace, the only one with panels registered so far.
  const defaultModel = useSettings(state => state.settings.generation.defaultModels.image)
  const [chosen, setChosen] = useState<string | null>(null)
  const modelId = chosen ?? defaultModel ?? null

  const authenticated = useSettings(state => state.auth.authenticated)
  const project = useProject(state => state.project)
  const submit = useJobs(state => state.submit)

  const models = useModels(authenticated)
  const descriptor = useDescriptor(modelId)

  if (!authenticated) {
    return <EmptyState icon={mdiCreationOutline} message={t('generation.noCredentials')} />
  }

  if (models.isPending) {
    return <EmptyState icon={mdiCreationOutline} message={t('generation.loadingModels')} />
  }

  if (!models.data?.length) {
    return <EmptyState icon={mdiCreationOutline} message={t('generation.noModel')} />
  }

  const generate = (body: FormValues): void => {
    if (modelId) void submit(modelId, body)
  }

  return (
    <div className="flex h-full flex-col overflow-auto">
      <label className="flex flex-col gap-1 p-2 text-xs">
        <span className="text-muted">{t('generation.model')}</span>
        <select
          className="bg-surface border-border h-(--sc-control) rounded-(--radius-sc-sm) border px-2"
          value={modelId ?? ''}
          onChange={event => setChosen(event.target.value)}
        >
          <option value="">{t('generation.chooseModel')}</option>
          {models.data.map(model => (
            <option key={model.id} value={model.id}>
              {model.name}
            </option>
          ))}
        </select>
      </label>

      {/* A project is where a generated asset lands; without one there is nowhere to put it. */}
      {!project && <p className="text-muted px-2 text-xs">{t('generation.noProject')}</p>}

      {descriptor.data && (
        <DynamicForm
          fields={descriptor.data.fields}
          onSubmit={generate}
          submitLabel={t('actions.generate')}
          busy={!project}
        />
      )}
    </div>
  )
}
