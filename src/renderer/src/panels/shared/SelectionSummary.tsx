import { useTranslation } from 'react-i18next'
import { PropertySection } from '@/design/PropertySection'
import { PropertyRow } from '@/design/PropertyRow'
import { formatBytes } from '@/helpers/format'

/**
 * What several things at once are read out as: how many, and how much they weigh.
 *
 * Summarised rather than detailed, whatever they are — showing the first one's prompt for a
 * selection of twelve is how someone regenerates the wrong thing, and showing the first one's
 * role is how someone corrects the wrong file.
 *
 * Written once for both faces that summarise: the assets picked in the shelf, and the files
 * picked in the explorer. Apart, the second was already answering with a count where the first
 * gave a count AND a size, from the same field under another name.
 */
export function SelectionSummary({ count, bytes }: { count: number; bytes: number }) {
  const { t, i18n } = useTranslation()

  return (
    <PropertySection title={t('inspector.selection')} scId="selection">
      <PropertyRow label={t('inspector.count')}>{count}</PropertyRow>
      {/* Nothing rather than « 0 o »: a selection the catalogue holds no size for has not been
          measured, which is a different thing from weighing nothing. */}
      {bytes > 0 && (
        <PropertyRow label={t('inspector.size')}>
          {formatBytes(bytes, unit => t(`units.${unit}`), i18n.language)}
        </PropertyRow>
      )}
    </PropertySection>
  )
}
