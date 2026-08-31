import { useTranslation } from 'react-i18next'
import { WindowNote } from '@/components/WindowNote'
import type { UsageReport } from '@shared/domain/usage'
import { UsageTable } from './UsageTable/UsageTable'
import { UsageTableHeadCell } from './UsageTable/UsageTableHeadCell'
import { UsageTableRow } from './UsageTable/UsageTableRow'
import { formatUnits } from '@/helpers/format'
import { shareOf } from './format'

/** What each model cost, which is the one question a spend table exists to answer. */
export function UsageModels({ report }: { report: UsageReport }) {
  const { t, i18n } = useTranslation()
  const locale = i18n.language

  if (report.models.length === 0) {
    return <WindowNote>{t('usage.empty')}</WindowNote>
  }

  const largest = report.models[0]?.units ?? 0

  return (
    <UsageTable
      head={
        <>
          <UsageTableHeadCell label={t('usage.columns.model')} />
          <UsageTableHeadCell label={t('usage.columns.units')} numeric />
          <UsageTableHeadCell label={t('usage.columns.jobs')} numeric />
          <UsageTableHeadCell label={t('usage.columns.apiKey')} numeric />
        </>
      }
    >
      {report.models.map(model => (
        <UsageTableRow key={model.modelId}>
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
          <td className="text-base-content/70 py-1.5 text-right font-mono">
            {formatUnits(model.apiKeyUnits, locale)}
          </td>
        </UsageTableRow>
      ))}
    </UsageTable>
  )
}
