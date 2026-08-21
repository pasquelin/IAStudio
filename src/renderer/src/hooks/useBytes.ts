import { useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import { formatBytes } from '@/helpers/format'

/**
 * A size, in the reader's language and units. Six older surfaces still spell the three arguments
 * out by hand — they are the sites to convert next, not a second way of doing this.
 */
export function useBytes(): (value: number) => string {
  const { t, i18n } = useTranslation()

  return useMemo(
    () => value => formatBytes(value, unit => t(`units.${unit}`), i18n.language),
    [t, i18n.language],
  )
}
