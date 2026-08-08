import { useTranslation } from 'react-i18next'
import type { UsageReport, UsageTally } from '@shared/domain/usage'
import { UsageNotes } from './UsageNotes'
import { formatUnits } from './format'

/** What was done, rather than which model did it: the same spend read from the other side. */
export function UsageActivities({ report }: { report: UsageReport }) {
  const { t } = useTranslation()

  if (report.actions.length === 0 && report.assets.length === 0) {
    return <p className="text-base-content/60 text-xs">{t('usage.empty')}</p>
  }

  return (
    <div className="flex flex-col gap-6">
      {report.actions.length > 0 && (
        <Tallies
          title={t('usage.actions')}
          nameHeader={t('usage.columns.action')}
          rows={report.actions}
          withUnits
        />
      )}

      {report.assets.length > 0 && (
        <Tallies
          title={t('usage.assets')}
          nameHeader={t('usage.columns.kind')}
          rows={report.assets}
        />
      )}

      <UsageNotes report={report} />
    </div>
  )
}

type TalliesProps = {
  title: string
  nameHeader: string
  rows: readonly UsageTally[]
  withUnits?: boolean
}

function Tallies({ title, nameHeader, rows, withUnits = false }: TalliesProps) {
  const { t, i18n } = useTranslation()
  const locale = i18n.language

  return (
    <section className="flex flex-col gap-2">
      <h2 className="text-xs font-medium">{title}</h2>
      <table className="w-full text-xs">
        <thead className="text-base-content/60">
          <tr className="border-base-300 border-b text-left">
            <th className="py-1.5 font-medium">{nameHeader}</th>
            <th className="py-1.5 text-right font-medium">{t('usage.columns.count')}</th>
            {withUnits && (
              <th className="py-1.5 text-right font-medium">{t('usage.columns.units')}</th>
            )}
          </tr>
        </thead>
        <tbody>
          {rows.map(row => (
            <tr key={row.label} className="border-base-300 border-b last:border-b-0">
              <td className="py-1.5">{row.label}</td>
              <td className="py-1.5 text-right font-mono">{formatUnits(row.count, locale)}</td>
              {withUnits && (
                <td className="py-1.5 text-right font-mono">
                  {formatUnits(row.units ?? 0, locale)}
                </td>
              )}
            </tr>
          ))}
        </tbody>
      </table>
    </section>
  )
}
