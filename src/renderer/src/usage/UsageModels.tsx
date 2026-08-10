import { useTranslation } from 'react-i18next'
import type { UsageReport } from '@shared/domain/usage'
import { HeadCell, Row, UsageTable } from './UsageTable'
import { formatUnits, shareOf } from './format'
import { WINDOW_CAPTION } from '@/design/window-styles'

/** What each model cost, which is the one question a spend table exists to answer. */
export function UsageModels({ report }: { report: UsageReport }) {
  const { t, i18n } = useTranslation()
  const locale = i18n.language

  if (report.models.length === 0) {
    return <p className={WINDOW_CAPTION}>{t('usage.empty')}</p>
  }

  const largest = report.models[0]?.units ?? 0

  return (
    <UsageTable
      head={
        <>
          <HeadCell label={t('usage.columns.model')} />
          <HeadCell label={t('usage.columns.units')} numeric />
          <HeadCell label={t('usage.columns.jobs')} numeric />
          <HeadCell label={t('usage.columns.apiKey')} numeric />
        </>
      }
    >
      {report.models.map(model => (
        <Row key={model.modelId}>
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
        </Row>
      ))}
    </UsageTable>
  )
}
