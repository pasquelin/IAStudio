import { useTranslation } from 'react-i18next'
import type { UsagePeriod, UsageReport } from '@shared/domain/usage'
import { WINDOW_CAPTION } from '@/design/window-styles'
import { HINT_RIGHT } from '@/helpers/tooltip'
import { UsageActivities } from '../UsageActivities/UsageActivities'
import { UsageJournal } from '../UsageJournal'
import { UsageModels } from '../UsageModels'
import { UsageNotes } from '../UsageNotes'
import { UsageOverview } from '../UsageOverview/UsageOverview'
import type { UsageSectionId } from '../sections'

export type UsageWindowBodyProps = {
  id: UsageSectionId
  period: UsagePeriod
  report: UsageReport | null
  failure: string | null
  onRetry: () => void
}

export function UsageWindowBody({ id, period, report, failure, onRetry }: UsageWindowBodyProps) {
  const { t } = useTranslation()

  if (failure) {
    return (
      <div className="flex flex-col items-start gap-2">
        <p className="text-xs">{t('usage.failure')}</p>
        <button
          type="button"
          className="btn btn-xs"
          {...HINT_RIGHT(t('usage.retryHint'))}
          onClick={onRetry}
        >
          {t('usage.retry')}
        </button>
      </div>
    )
  }

  if (!report) return <p className={WINDOW_CAPTION}>{t('usage.loading')}</p>

  // Zeros across the board because nothing was spent, or because there is no key to ask? Only
  // this tells them apart, and a table of zeros reads as the first when it is the second.
  if (report.accounts.length === 0 && report.silent.length === 0) {
    return <p className={WINDOW_CAPTION}>{t('usage.noAccount')}</p>
  }

  return (
    <div className="flex flex-col gap-6">
      {id === 'overview' && <UsageOverview report={report} />}
      {id === 'models' && <UsageModels report={report} />}
      {id === 'activities' && <UsageActivities report={report} />}
      {id === 'journal' && <UsageJournal period={period} />}

      {/* Once, under whichever screen is open — rather than repeated inside three of them. */}
      <UsageNotes report={report} />
    </div>
  )
}
