import { useTranslation } from 'react-i18next'
import type { ModelSummary } from '@shared/domain/model'
import type { PlanAccess } from '@shared/domain/plan'
import { isBeyondPlan } from '@shared/domain/plan'

/** All a picker row reads off a model; the rest of a summary never reaches the label. */
export type PickableModel = Pick<ModelSummary, 'id' | 'name' | 'requiredPlanLevel' | 'description'>

export type ModelOptionsProps = {
  models: readonly PickableModel[]
  plan: PlanAccess | null
}

/**
 * One `<option>` per model, the ones the account's plan refuses disabled and told so.
 *
 * A native `<option>` carries no tooltip — react-tooltip needs pointer events a disabled option
 * never emits — so the reason is suffixed onto the label. Saying it is the point: a picker that
 * greys a name out without a word is a dead end.
 */
export function ModelOptions({ models, plan }: ModelOptionsProps) {
  const { t } = useTranslation()
  const locked = t('models.planLocked')

  return (
    <>
      {models.map(model => {
        const refused = isBeyondPlan(model.requiredPlanLevel, plan)
        const label = [model.name, model.description, refused ? locked : undefined]
          .filter(part => part)
          .join(' — ')
        return (
          <option key={model.id} value={model.id} disabled={refused}>
            {label}
          </option>
        )
      })}
    </>
  )
}
