import { useTranslation } from 'react-i18next'
import { PropertyRow } from '@/design/PropertyRow'
import { formatDuration } from '@/engines/timeline/timecode'
import { formatBytes, formatMoment } from '@/helpers/format'

/**
 * What both inspectors read out of an asset, whichever side it lives on. Written once because a
 * catalogue row and a library one answer the same four questions from different fields, and two
 * copies drift at the first format changed.
 */
export type AssetMeasures = {
  /** Microseconds, as the rest of the studio counts — the library's own seconds convert here. */
  duration?: number
  width?: number
  height?: number
  bytes?: number
  createdAt: string
}

export function AssetMeasureRows({ duration, width, height, bytes, createdAt }: AssetMeasures) {
  const { t, i18n } = useTranslation()

  return (
    <>
      {duration !== undefined && (
        <PropertyRow label={t('inspector.duration')}>{formatDuration(duration)}</PropertyRow>
      )}
      {width !== undefined && height !== undefined && (
        <PropertyRow label={t('inspector.dimensions')}>
          {width} × {height}
        </PropertyRow>
      )}
      {bytes !== undefined && (
        <PropertyRow label={t('inspector.size')}>
          {formatBytes(bytes, unit => t(`units.${unit}`), i18n.language)}
        </PropertyRow>
      )}
      {/* The studio's language, not the machine's — and local, because this says when a person
          made the thing, not what an account was billed. */}
      <PropertyRow label={t('inspector.created')}>
        {formatMoment(createdAt, i18n.language, 'local')}
      </PropertyRow>
    </>
  )
}
