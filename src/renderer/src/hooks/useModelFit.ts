import { useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import type { MachineSummary, ModelCandidate } from '@shared/domain/aiOverview'
import { downloadBytesOf } from '@shared/domain/localModel'
import { fitAllowsUse, type FitObstacle } from '@shared/domain/modelFit'
import { useBytes } from './useBytes'

/**
 * The sentence each obstacle needs. A table rather than a switch, so the compiler asks the day
 * one is added and the i18n guard reads the keys off it — `tight` and `memory` share theirs.
 */
export const FIT_DETAIL_KEYS: Record<FitObstacle, string> = {
  refused: 'aiModels.detail.refused',
  disk: 'aiModels.detail.disk',
  memory: 'aiModels.detail.memory',
  tight: 'aiModels.detail.memory',
}

/** What the machine says about a candidate, and whether it may be picked. */
export type ModelFitSentence = {
  /** Always said, whatever it is: nothing is hidden, everything is explained. */
  verdict: string
  /** Said under it when the verdict alone would leave a dimmed row unexplained. */
  note: string | undefined
  usable: boolean
}

/**
 * How each candidate stands, said in words. Same shape as `usePlanRefusal`, and deliberately:
 * one answer greys a row and explains it, rather than a second refusal channel — ADR-19.
 */
export function useModelFit(
  machine: MachineSummary | null,
): (candidate: ModelCandidate) => ModelFitSentence {
  const { t } = useTranslation()
  const bytes = useBytes()

  return useMemo(() => {
    // The figures of a machine nothing has answered for yet are never read: the screen says so
    // and renders no candidate until the overview lands.
    const available = machine?.availableBytes ?? 0
    const free = machine?.diskFreeBytes ?? null

    return candidate => {
      const word = t(`aiModels.fit.${candidate.fit}`)
      const verdict =
        candidate.obstacle === null
          ? word
          : t('aiModels.verdict', {
              word,
              detail: t(FIT_DETAIL_KEYS[candidate.obstacle], {
                needed: bytes(
                  candidate.obstacle === 'disk'
                    ? downloadBytesOf(candidate.model)
                    : candidate.model.reservationBytes,
                ),
                available: bytes(available),
                free: free === null ? '' : bytes(free),
              }),
            })

      // No note on this one: the verdict already names what stands in the way.
      if (!fitAllowsUse(candidate.fit)) return { verdict, note: undefined, usable: false }
      // Storable, but it would serve nothing: `providerFor` only hands a role a model that is
      // both installed and usable, so a choice made here would fall back without a word.
      if (!candidate.installed) {
        return { verdict, note: t('aiModels.notInstalledYet'), usable: false }
      }

      return { verdict, note: undefined, usable: true }
    }
  }, [t, bytes, machine])
}
