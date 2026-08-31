import { useTranslation } from 'react-i18next'
import type { UsageTally } from '@shared/domain/usage'
import { formatUnits } from '@/helpers/format'
import { UsageTable } from '../Table/UsageTable'
import { UsageTableHeadCell } from '../Table/UsageTableHeadCell'
import { UsageTableRow } from '../Table/UsageTableRow'

export type UsageActivitiesTalliesProps = {
  title: string
  nameHeader: string
  rows: readonly UsageTally[]
  /** Where the row names are said, the label itself being the API's own — `images-generation`. */
  names: 'usage.actionNames' | 'usage.assetKinds'
  withUnits?: boolean
}

export function UsageActivitiesTallies({
  title,
  nameHeader,
  rows,
  names,
  withUnits = false,
}: UsageActivitiesTalliesProps) {
  const { t, i18n } = useTranslation()
  const locale = i18n.language

  return (
    <section className="flex flex-col gap-2">
      <h3 className="text-xs font-medium">{title}</h3>
      <UsageTable
        head={
          <>
            <UsageTableHeadCell label={nameHeader} />
            <UsageTableHeadCell label={t('usage.columns.count')} numeric />
            {withUnits && <UsageTableHeadCell label={t('usage.columns.units')} numeric />}
          </>
        }
      >
        {rows.map(row => (
          <UsageTableRow key={row.label}>
            {/* Scenario adds usage names without notice: an unnamed one shows as the API sent it. */}
            <td className="py-1.5">{t(`${names}.${row.label}`, { defaultValue: row.label })}</td>
            <td className="py-1.5 text-right font-mono">{formatUnits(row.count, locale)}</td>
            {withUnits && (
              <td className="py-1.5 text-right font-mono">{formatUnits(row.units ?? 0, locale)}</td>
            )}
          </UsageTableRow>
        ))}
      </UsageTable>
    </section>
  )
}
