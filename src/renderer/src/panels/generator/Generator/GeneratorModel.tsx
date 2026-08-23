import { useTranslation } from 'react-i18next'
import type { AiRoleId } from '@shared/domain/aiRole'
import { SCENARIO_CLOUD } from '@shared/domain/aiCloud'
import { LOCAL_RUNTIME, type ModelSummary } from '@shared/domain/model'
import { ModelPicker } from '@/design/ModelPicker/ModelPicker'
import { useModelsForCapability } from '@/hooks/useModelsForCapability'
import { usePlanAccess } from '@/hooks/usePlanAccess'
import { useModelReach } from '@/hooks/useModelReach'
import { useModels } from '@/stores/models'
import { useAiModels } from '@/stores/aiModels'
import { useProject } from '@/stores/project'

export type GeneratorModelProps = {
  capability: AiRoleId
  /** The model serving it right now, or `null` when nothing does yet. */
  modelId: string | null
  /**
   * What the model in use is called, from its own descriptor.
   *
   * The picker shows the head of the catalogue, so a model chosen long ago may not be in the
   * hundred it holds — and a control whose value matches no row draws blank, which reads as a
   * panel that lost its model. The screen this replaced kept the stored one the same way.
   */
  name?: string
}

/**
 * What a model outside the picker's own page is drawn as. Everything but its id and its name is
 * unknown here — the descriptor answers those two and nothing else.
 */
const UNLISTED: Omit<ModelSummary, 'id' | 'name'> = {
  family: 'other',
  runsOn: SCENARIO_CLOUD,
  source: 'other',
  origin: 'community',
  featured: false,
  capabilities: [],
  tags: [],
}

/** Where it runs, and what stands between it and a generation — § 20, said before the click. */
function captionOf(
  model: ModelSummary,
  refusal: string | undefined,
  t: (key: string) => string,
): string {
  const where =
    model.runsOn === LOCAL_RUNTIME ? t('models.runsLocally') : t(`aiClouds.${model.runsOn}`)
  const state = refusal ?? (model.installed === true ? t('generation.modelInstalled') : undefined)

  return state === undefined ? where : `${where} · ${state}`
}

/**
 * The model in use, at the head of the panel — the § 15 of the brief: visible while a prompt is
 * written, changed without leaving.
 *
 * Picking one writes the preference of THIS employment and no other (ADR-23 § C): the same
 * weights serve several, and a person may well have picked differently for each.
 */
export function GeneratorModel({ capability, modelId, name }: GeneratorModelProps) {
  const { t } = useTranslation()
  const models = useModelsForCapability(capability)
  const select = useModels(state => state.select)
  const chooseAiProvider = useAiModels(state => state.chooseAiProvider)
  const projectPath = useProject(state => state.project?.path ?? null)
  const reachOf = useModelReach(usePlanAccess())

  const refusalOf = (model: ModelSummary): string | undefined => reachOf(model).refusal?.word
  const chosen = models.find(one => one.id === modelId)
  const offered =
    chosen || !modelId ? models : [{ ...UNLISTED, id: modelId, name: name ?? modelId }, ...models]

  return (
    <div className="px-2 pt-2">
      <ModelPicker
        models={offered}
        value={modelId}
        onChange={id => {
          const model = models.find(one => one.id === id)
          if (!model) return

          select(capability, id)
          void chooseAiProvider(
            capability,
            model.runsOn === LOCAL_RUNTIME
              ? { kind: 'local', modelId: id }
              : { kind: 'cloud', providerId: model.runsOn },
            projectPath === null ? 'app' : 'project',
          )
        }}
        refusalOf={refusalOf}
        caption={chosen ? captionOf(chosen, refusalOf(chosen), t) : undefined}
        emptyLabel={t('generation.chooseModel')}
      />
    </div>
  )
}
