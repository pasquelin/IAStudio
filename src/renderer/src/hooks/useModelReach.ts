import { useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import type { ModelSummary } from '@shared/domain/model'
import type { PlanAccess } from '@shared/domain/plan'
import { usePlanRefusal } from './usePlanRefusal'

/**
 * Why a model cannot be picked right now, or `undefined` when it can.
 *
 * Two reasons, and they are not the same gesture: a plan that does not reach it is a purchase,
 * where weights that are not on the disk are a download the studio can start itself. The
 * download is the ONE case that answers a second thing — `fetchable` — so a click can offer it
 * rather than leaving a dimmed tile the person can only wonder about.
 */
export type ModelReach = {
  /** Said on the tile and in its tooltip. `undefined` when nothing stands in the way. */
  refusal: string | undefined
  /** Whether the studio can fix it by fetching the weights, rather than the person by buying. */
  fetchable: boolean
}

const WITHIN: ModelReach = { refusal: undefined, fetchable: false }

export function useModelReach(plan: PlanAccess | null): (model: ModelSummary) => ModelReach {
  const { t } = useTranslation()
  const refusalFor = usePlanRefusal(plan)

  return useMemo(() => {
    const notHere = t('models.notInstalled')

    return model => {
      const beyondPlan = refusalFor(model.requiredPlanLevel)
      if (beyondPlan !== undefined) return { refusal: beyondPlan, fetchable: false }

      // `installed` is absent for a model that runs in a cloud, where there is nothing to fetch.
      return model.installed === false ? { refusal: notHere, fetchable: true } : WITHIN
    }
  }, [refusalFor, t])
}
