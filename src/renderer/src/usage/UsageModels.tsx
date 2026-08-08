import { useTranslation } from 'react-i18next'
import type { UsageReport } from '@shared/domain/usage'
import { UsageNotes } from './UsageNotes'
import { formatUnits, shareOf } from './format'

/** What each model cost, which is the one question a spend table exists to answer. */
export function UsageModels({ report }: { report: UsageReport }) {
  const { t, i18n } = useTranslation()
  const locale = i18n.language

  if (report.models.length === 0) {
    return <p className="text-base-content/60 text-xs">{t('usage.empty')}</p>
  }

  const largest = report.models[0]?.units ?? 0

  return (
    <div className="flex flex-col gap-6">
      <table className="w-full text-xs">
        <thead className="text-base-content/60">
          <tr className="border-base-300 border-b text-left">
            <th className="py-1.5 font-medium">{t('usage.columns.model')}</th>
            <th className="py-1.5 text-right font-medium">{t('usage.columns.units')}</th>
            <th className="py-1.5 text-right font-medium">{t('usage.columns.jobs')}</th>
            <th className="py-1.5 text-right font-medium">{t('usage.columns.apiKey')}</th>
          </tr>
        </thead>
        <tbody>
          {report.models.map(model => (
            <tr key={model.modelId} className="border-base-300 border-b last:border-b-0">
              <td className="max-w-64 py-1.5">
                <span className="block truncate" title={model.name}>
                  {model.name}
                </span>
                <span
                  aria-hidden
                  className="bg-primary mt-1 block h-0.5 rounded"
                  style={{ width: `${shareOf(model.units, largest)}%` }}
                />
              </td>
              <td className="py-1.5 text-right font-mono">{formatUnits(model.units, locale)}</td>
              <td className="py-1.5 text-right font-mono">{formatUnits(model.jobs, locale)}</td>
              <td className="text-base-content/60 py-1.5 text-right font-mono">
                {formatUnits(model.apiKeyUnits, locale)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      <UsageNotes report={report} />
    </div>
  )
}
