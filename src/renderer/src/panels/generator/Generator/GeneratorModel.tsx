import { useCallback, useId, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { providerOfModel, type AiRoleId } from '@shared/domain/aiRole'
import type { ModelSummary } from '@shared/domain/model'
import type { PlanAccess } from '@shared/domain/plan'
import { ModelPicker } from '@/design/ModelPicker/ModelPicker'
import { ModelDownloadDialog } from '@/panels/models/Models/ModelDownloadDialog'
import { runtimeLabel } from '@/helpers/runtimeLabel'
import { FormField } from '@/design/FormField'
import { useLazyPreviews } from '@/hooks/useLazyPreviews'
import { useModelsForCapability } from '@/hooks/useModelsForCapability'
import { useModelReach, type ModelRefusalWord } from '@/hooks/useModelReach'
import { useModels } from '@/stores/models'
import { useAiModels } from '@/stores/aiModels'

export type GeneratorModelProps = {
  capability: AiRoleId
  /** Read once by the panel above: `usePlanAccess` is a round trip, and two mount two. */
  plan: PlanAccess | null
  /** The model serving it right now, or `null` when nothing does yet. */
  modelId: string | null
  /**
   * What the model in use is called. The picker holds the head of the catalogue only, and a
   * control whose value matches no row draws blank — which reads as a panel that lost its model.
   */
  name?: string
}

/** Where it runs, and what stands between it and a generation — said before the click. */
function captionOf(
  model: ModelSummary,
  refusal: ModelRefusalWord | undefined,
  t: (key: string) => string,
): string {
  const where = runtimeLabel(model.runsOn, t)
  const state =
    refusal?.word ?? (model.installed === true ? t('generation.modelInstalled') : undefined)

  return state === undefined ? where : `${where} · ${state}`
}

/**
 * The model in use, visible while a prompt is written. Picking one writes the preference of THIS
 * employment and no other (ADR-23 § C): the same weights serve several.
 */
export function GeneratorModel({ capability, modelId, name, plan }: GeneratorModelProps) {
  const field = useId()
  const { t } = useTranslation()
  const models = useModelsForCapability(capability)
  const select = useModels(state => state.select)
  const chooseAiProvider = useAiModels(state => state.chooseAiProvider)
  const projectPath = useAiModels(state => state.overview?.projectPath ?? null)
  const reachOf = useModelReach(plan)

  // Memoised on the answer it narrows, which `useModelReach` already keeps stable: an inline
  // arrow here handed the picker a new function per render, and every row with it.
  const refusalOf = useCallback(
    (model: ModelSummary): ModelRefusalWord | undefined => reachOf(model).refusal,
    [reachOf],
  )

  const { pictureOf, resolveFor } = useLazyPreviews()
  const chosen = models.find(one => one.id === modelId)
  const [offered, setOffered] = useState<ModelSummary | null>(null)

  return (
    <div>
      {offered && <ModelDownloadDialog model={offered} onClose={() => setOffered(null)} />}

      <FormField label={t('generation.model')} htmlFor={field}>
        <ModelPicker
          id={field}
          models={models}
          value={modelId}
          onChange={id => {
            const model = models.find(one => one.id === id)
            if (!model) return

            // 🛑 The one refusal the studio can lift itself: arming weights that are not on the
            // disk builds a generation that cannot run, where the offer to fetch them is right
            // here. ADR-23 § D — the panel downloads or sends to configure, without leaving.
            if (reachOf(model).fetchable) {
              setOffered(model)
              return
            }

            select(capability, id)
            void chooseAiProvider(
              capability,
              providerOfModel(model),
              projectPath === null ? 'app' : 'project',
            )
          }}
          refusalOf={refusalOf}
          pictureOf={pictureOf}
          onVisible={resolveFor}
          caption={chosen ? captionOf(chosen, refusalOf(chosen), t) : undefined}
          valueLabel={name}
          emptyLabel={t('generation.chooseModel')}
        />
      </FormField>
    </div>
  )
}
