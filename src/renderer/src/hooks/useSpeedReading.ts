import { useCallback } from 'react'
import { useTranslation } from 'react-i18next'
import { formatDecimal } from '@/helpers/format'

/**
 * How a fly speed reads. ALWAYS one decimal: the length then follows the whole part alone, which
 * is what lets the widest reading be taken from the bound rather than from a list the slider
 * steps between.
 */
export function useSpeedReading(): (speed: number) => string {
  const { t, i18n } = useTranslation()

  return useCallback(
    speed =>
      t('snapBar.speedValue', {
        value: formatDecimal(speed, i18n.language, { digits: 1, least: 1 }),
      }),
    [t, i18n.language],
  )
}
