import { useTranslation } from 'react-i18next'
import type { UsageReport, UsageTally } from '@shared/domain/usage'
import { HeadCell, Row, UsageTable } from './UsageTable'
import { formatUnits } from './format'
import { WINDOW_CAPTION } from '@/design/window-styles'

/** What was done, rather than which model did it: the same spend read from the other side. */
export function UsageActivities({ report }: { report: UsageReport }) {
  const { t } = useTranslation()

  if (report.actions.length === 0 && report.assets.length === 0) {
    return <p className={WINDOW_CAPTION}>{t('usage.empty')}</p>
  }

  return (
    <div className="flex flex-col gap-6">
      {report.actions.length > 0 && (
        <Tallies
          title={t('usage.actions')}
          nameHeader={t('usage.columns.action')}
          rows={report.actions}
          names="usage.actionNames"
          withUnits
        />
      )}

      {report.assets.length > 0 && (
        <Tallies
          title={t('usage.assets')}
          nameHeader={t('usage.columns.kind')}
          rows={report.assets}
          names="usage.assetKinds"
        />
      )}
    </div>
  )
}

type TalliesProps = {
  title: string
  nameHeader: string
  rows: readonly UsageTally[]
  /** Where the row names are said, the label itself being the API's own — `images-generation`. */
  names: 'usage.actionNames' | 'usage.assetKinds'
  withUnits?: boolean
}

function Tallies({ title, nameHeader, rows, names, withUnits = false }: TalliesProps) {
  const { t, i18n } = useTranslation()
  const locale = i18n.language

  return (
    <section className="flex flex-col gap-2">
      <h3 className="text-xs font-medium">{title}</h3>
      <UsageTable
        head={
          <>
            <HeadCell label={nameHeader} />
            <HeadCell label={t('usage.columns.count')} numeric />
            {withUnits && <HeadCell label={t('usage.columns.units')} numeric />}
          </>
        }
      >
        {rows.map(row => (
          <Row key={row.label}>
            {/* Scenario adds usage names without notice: an unnamed one shows as the API sent it. */}
            <td className="py-1.5">{t(`${names}.${row.label}`, { defaultValue: row.label })}</td>
            <td className="py-1.5 text-right font-mono">{formatUnits(row.count, locale)}</td>
            {withUnits && (
              <td className="py-1.5 text-right font-mono">{formatUnits(row.units ?? 0, locale)}</td>
            )}
          </Row>
        ))}
      </UsageTable>
    </section>
  )
}
