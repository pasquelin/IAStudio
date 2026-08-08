import { useTranslation } from 'react-i18next'
import type { UsagePeriod } from '@shared/domain/usage'
import { formatMoment, formatUnits } from './format'
import { useUsageEvents } from './useUsageReport'

/**
 * The raw billable log, event by event.
 *
 * Loads when this section is opened, not with the window: over 120 days it is the one call heavy
 * enough to make opening feel slow, and it is nobody's first screen.
 */
export function UsageJournal({ period }: { period: UsagePeriod }) {
  const { t, i18n } = useTranslation()
  const locale = i18n.language
  const { page, loading, failure, more } = useUsageEvents(period, true)

  if (failure) return <p className="text-xs">{t('usage.failure')}</p>
  if (!page && loading) return <p className="text-base-content/60 text-xs">{t('usage.loading')}</p>
  if (!page || page.events.length === 0) {
    return <p className="text-base-content/60 text-xs">{t('usage.empty')}</p>
  }

  return (
    <div className="flex flex-col gap-3">
      <table className="w-full text-xs">
        <thead className="text-base-content/60">
          <tr className="border-base-300 border-b text-left">
            <th className="py-1.5 font-medium">{t('usage.columns.time')}</th>
            <th className="py-1.5 font-medium">{t('usage.columns.action')}</th>
            <th className="py-1.5 font-medium">{t('usage.columns.model')}</th>
            <th className="py-1.5 font-medium">{t('usage.columns.account')}</th>
            <th className="py-1.5 text-right font-medium">{t('usage.columns.units')}</th>
          </tr>
        </thead>
        <tbody>
          {page.events.map((event, index) => (
            <tr
              key={`${event.time}-${event.jobId ?? index}`}
              className="border-base-300 border-b last:border-b-0"
            >
              <td className="py-1.5 whitespace-nowrap">{formatMoment(event.time, locale)}</td>
              <td className="py-1.5">{event.action}</td>
              <td className="max-w-48 truncate py-1.5" title={event.modelName}>
                {event.modelName ?? '—'}
              </td>
              <td className="py-1.5">{event.accountName}</td>
              <td className="py-1.5 text-right font-mono">
                {event.units === 0 ? (
                  <span className="text-base-content/60">{t('usage.free')}</span>
                ) : (
                  formatUnits(event.units, locale)
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      {page.more && (
        <button type="button" className="btn btn-xs self-start" onClick={more} disabled={loading}>
          {t('usage.loadMore')}
        </button>
      )}
    </div>
  )
}
