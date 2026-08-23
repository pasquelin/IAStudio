import { mdiInformationOutline } from '@mdi/js'
import { memo } from 'react'
import { useTranslation } from 'react-i18next'
import type { AiOverview, ChoiceScope, ModelCandidate, RoleRow } from '@shared/domain/aiOverview'
import { MODEL_SOURCES, sourceOf, type ModelSource } from '@shared/domain/localModel'
import { UiIcon } from '@/design/UiIcon'
import { WINDOW_CAPTION, WINDOW_GROUP_LABEL } from '@/design/windowStyles'
import type { ModelFitSentence } from '@/hooks/useModelFit'
import { useAiModels } from '@/stores/aiModels'
import { useModels } from '@/stores/models'
import { AiCandidateRow } from './AiCandidateRow'
import { AiChoiceRow } from './AiChoiceRow'
import { roleLabel } from './roleLabel'

const SOURCE_COPY: Record<ModelSource, { title: string; help?: string }> = {
  studio: { title: 'aiModels.sourceStudio', help: 'aiModels.sourceStudioHelp' },
  ollama: { title: 'aiModels.sourceOllama', help: 'aiModels.sourceOllamaHelp' },
  custom: { title: 'aiModels.sourceCustom' },
}

export type AiRoleRowProps = {
  row: RoleRow
  /** The install in flight when it is one of THIS row's candidates, so the others hold their render. */
  installing: AiOverview['installing']
  /** The load in flight, on the same terms — one at a time, and only the row that owns it. */
  loading: AiOverview['loading']
  /** Whether some install holds the disk, wherever it was begun. */
  busy: boolean
  /** Where a click writes — the application default, or the open project alone. */
  scope: ChoiceScope
  fitOf: (candidate: ModelCandidate) => ModelFitSentence
}

/**
 * One EMPLOYMENT and what serves it, never one model. Folded by default — a choice already
 * made needs no attention — and unfolded it shows every local candidate, those too heavy included.
 */
export const AiRoleRow = memo(function AiRoleRow({
  row,
  installing,
  loading,
  busy,
  scope,
  fitOf,
}: AiRoleRowProps) {
  const { t } = useTranslation()
  const chooseAiProvider = useAiModels(state => state.chooseAiProvider)
  const selectRoleModel = useModels(state => state.select)

  const label = roleLabel(row.role, t)
  // Captured so the narrowing survives into the callback below, which a property access does not.
  const provider = row.provider
  // What SERVES the role, which is not always what was chosen: a model since uninstalled falls
  // back, and the summary has to say what answers today rather than what was asked for.
  const served =
    provider?.kind === 'local'
      ? row.candidates.find(candidate => candidate.model.id === provider.modelId)
      : undefined
  // The controls, unlike the summary, show the scope BEING EDITED: a radio reading the effect
  // would leave a click writing a scope that already agreed, doing nothing and saying nothing.
  const editing = row.chosen[scope]

  return (
    <details className="border-base-300 border-b last:border-b-0">
      <summary className="flex cursor-pointer items-center gap-2 py-3">
        <span className="flex-1">{label}</span>
        {row.chosen.project !== null && (
          <span className="badge badge-sm">{t('aiModels.chosenAtProject')}</span>
        )}
        <span className={WINDOW_CAPTION}>
          {served && served.model.name}
          {provider?.kind === 'cloud' && t(`aiClouds.${provider.providerId}`)}
          {provider === null && t('aiModels.providerNone')}
        </span>
      </summary>

      <fieldset className="pt-3 pb-4">
        <legend className="sr-only">{t('aiModels.candidates', { role: label })}</legend>
        <ul>
          <AiChoiceRow
            role={row.role}
            choice="none"
            label={t('aiModels.none')}
            hint={t('aiModels.noneHint')}
            checked={editing === null}
            onChoose={() => void chooseAiProvider(row.role, null, scope)}
          />

          {/* 🛑 Silence here reads as a broken list: what is missing is an engine, not a manifest.
              No role="alert" — a live region would announce a standing state on every render. */}
          {provider === null && (
            <li className="py-2">
              <span className="alert alert-warning alert-soft">
                <UiIcon path={mdiInformationOutline} />
                {t('aiModels.chooseProvider')}
              </span>
            </li>
          )}
          {row.candidates.length === 0 && (
            <li className="py-2">
              <span className="alert alert-info alert-soft">
                <UiIcon path={mdiInformationOutline} />
                {t('aiModels.noLocalEngine')}
              </span>
            </li>
          )}

          {MODEL_SOURCES.map(source => {
            const candidates = row.candidates.filter(one => sourceOf(one.model) === source)
            if (candidates.length === 0) return null
            const copy = SOURCE_COPY[source]

            return (
              <li key={source} className="pt-6">
                <h4 className={WINDOW_GROUP_LABEL}>{t(copy.title)}</h4>
                {copy.help !== undefined && <p className={WINDOW_CAPTION}>{t(copy.help)}</p>}
                <ul>
                  {candidates.map(candidate => (
                    <AiCandidateRow
                      key={candidate.model.id}
                      role={row.role}
                      candidate={candidate}
                      chosen={editing?.kind === 'local' && editing.modelId === candidate.model.id}
                      fit={fitOf(candidate)}
                      progress={
                        installing?.modelId === candidate.model.id ? installing.progress : null
                      }
                      loading={loading?.modelId === candidate.model.id ? loading.ratio : null}
                      busy={busy}
                      onChoose={() => {
                        void chooseAiProvider(
                          row.role,
                          { kind: 'local', modelId: candidate.model.id },
                          scope,
                        )
                        selectRoleModel(row.role, candidate.model.id)
                      }}
                    />
                  ))}
                </ul>
              </li>
            )
          })}

          {row.clouds.length > 0 && (
            <li className="pt-6">
              <h4 className={WINDOW_GROUP_LABEL}>{t('aiModels.sourceCloud')}</h4>
              <p className={WINDOW_CAPTION}>{t('aiModels.sourceCloudHelp')}</p>
              <ul>
                {row.clouds.map(providerId => (
                  <AiChoiceRow
                    key={providerId}
                    role={row.role}
                    choice={providerId}
                    label={t(`aiClouds.${providerId}`)}
                    hint={t(`aiClouds.${providerId}Hint`)}
                    checked={editing?.kind === 'cloud' && editing.providerId === providerId}
                    onChoose={() =>
                      void chooseAiProvider(row.role, { kind: 'cloud', providerId }, scope)
                    }
                  />
                ))}
              </ul>
            </li>
          )}
        </ul>
      </fieldset>
    </details>
  )
})
