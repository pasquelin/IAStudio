import { mdiInformationOutline } from '@mdi/js'
import { memo } from 'react'
import { useTranslation } from 'react-i18next'
import type { AiOverview, ChoiceScope, ModelCandidate, RoleRow } from '@shared/domain/aiOverview'
import { partsOfRole } from '@shared/domain/aiRole'
import { MODEL_SOURCES, sourceOf, type ModelSource } from '@shared/domain/localModel'
import { UiIcon } from '@/design/UiIcon'
import { WINDOW_CAPTION, WINDOW_GROUP_LABEL } from '@/design/windowStyles'
import type { ModelFitSentence } from '@/hooks/useModelFit'
import { useAiModels } from '@/stores/aiModels'
import { useModels } from '@/stores/models'
import { AiCandidateRow } from './AiCandidateRow'
import { AiChoiceRow } from './AiChoiceRow'
import { roleLabel } from './roleLabel'

const SOURCE_KEY: Record<ModelSource, string> = {
  studio: 'aiModels.sourceStudio',
  ollama: 'aiModels.sourceOllama',
  custom: 'aiModels.sourceCustom',
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
 * made needs no attention — and unfolded it shows every candidate, those too heavy included.
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
  const selectFamilyModel = useModels(state => state.select)

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
  const openId = editing?.kind === 'local' ? editing.modelId : (served?.model.id ?? null)

  const rowOf = (candidate: ModelCandidate, chosen: boolean) => (
    <AiCandidateRow
      key={candidate.model.id}
      role={row.role}
      candidate={candidate}
      chosen={chosen}
      fit={fitOf(candidate)}
      progress={installing?.modelId === candidate.model.id ? installing.progress : null}
      loading={loading?.modelId === candidate.model.id ? loading.ratio : null}
      busy={busy}
      onChoose={() => {
        void chooseAiProvider(row.role, { kind: 'local', modelId: candidate.model.id }, scope)
        const parts = partsOfRole(row.role)
        if (parts) selectFamilyModel(parts.family, candidate.model.id)
      }}
    />
  )

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

      <fieldset className="pb-3">
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

          {/* 🛑 Said rather than left blank: an employment with no local candidate is a list with
              nothing but the clouds in it, and silence there reads as something broken. What is
              missing is an ENGINE, not a manifest — the studio carries llama.cpp and sherpa-onnx,
              and nothing that draws.

              No `role="alert"`, which DaisyUI's own examples carry: that is a live region, and
              this is a standing state rather than something that just happened — announced on
              every render, it would interrupt for news that is not new. */}
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

            const shown = candidates.filter(one => one.model.id === openId)
            const folded = candidates.filter(one => one.model.id !== openId)

            return (
              <li key={source}>
                <h4 className={WINDOW_GROUP_LABEL}>{t(SOURCE_KEY[source])}</h4>
                {source === 'studio' && (
                  <p className={WINDOW_CAPTION}>{t('aiModels.sourceStudioHelp')}</p>
                )}
                {source === 'ollama' && (
                  <p className={WINDOW_CAPTION}>{t('aiModels.sourceOllamaHelp')}</p>
                )}
                <ul>
                  {shown.map(candidate =>
                    rowOf(
                      candidate,
                      editing?.kind === 'local' && editing.modelId === candidate.model.id,
                    ),
                  )}
                  {folded.length > 0 && (
                    <li>
                      <details>
                        <summary
                          className={WINDOW_CAPTION}
                          onClick={event => event.stopPropagation()}
                        >
                          {t('aiModels.otherModels', { count: folded.length })}
                        </summary>
                        <ul>{folded.map(candidate => rowOf(candidate, false))}</ul>
                      </details>
                    </li>
                  )}
                </ul>
              </li>
            )
          })}

          {row.clouds.length > 0 && (
            <li>
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
