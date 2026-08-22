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
/** The word a tile shows for a refusal, and the sentence its tooltip explains it with. */
export type ModelRefusalWord = { word: string; hint: string }

export type ModelReach = {
  /**
   * The two words the tile shows, and the sentence its tooltip explains them with.
   *
   * The word is carried rather than spelled by the tile: a local model depends on no
   * subscription, and a badge fixed on "beyond your plan" said exactly that about eight models
   * whose only problem was not being downloaded yet.
   */
  refusal: ModelRefusalWord | undefined
  /** Whether the studio can fix it by fetching the weights, rather than the person by buying. */
  fetchable: boolean
}

const WITHIN: ModelReach = { refusal: undefined, fetchable: false }

export function useModelReach(plan: PlanAccess | null): (model: ModelSummary) => ModelReach {
  const { t } = useTranslation()
  const refusalFor = usePlanRefusal(plan)

  return useMemo(() => {
    const absent = { word: t('models.notInstalled'), hint: t('models.notInstalledHint') }

    return model => {
      // 🛑 Before the plan, and never after: a model of THIS machine answers to no subscription,
      // and asking first said "beyond your plan" about weights that were only missing.
      // `installed` is absent for a cloud model, where there is nothing to fetch.
      if (model.installed === false) return { refusal: absent, fetchable: true }

      const beyond = refusalFor(model.requiredPlanLevel)
      return beyond === undefined
        ? WITHIN
        : { refusal: { word: t('models.planLocked'), hint: beyond }, fetchable: false }
    }
  }, [refusalFor, t])
}
