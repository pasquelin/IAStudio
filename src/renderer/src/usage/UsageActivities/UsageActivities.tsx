import { useTranslation } from 'react-i18next'
import type { UsageReport } from '@shared/domain/usage'
import { WINDOW_CAPTION } from '@/design/windowStyles'
import { UsageActivitiesTallies } from './UsageActivitiesTallies'

/** What was done, rather than which model did it: the same spend read from the other side. */
export function UsageActivities({ report }: { report: UsageReport }) {
  const { t } = useTranslation()

  if (report.actions.length === 0 && report.assets.length === 0) {
    return <p className={WINDOW_CAPTION}>{t('usage.empty')}</p>
  }

  return (
    <div className="flex flex-col gap-6">
      {report.actions.length > 0 && (
        <UsageActivitiesTallies
          title={t('usage.actions')}
          nameHeader={t('usage.columns.action')}
          rows={report.actions}
          names="usage.actionNames"
          withUnits
        />
      )}

      {report.assets.length > 0 && (
        <UsageActivitiesTallies
          title={t('usage.assets')}
          nameHeader={t('usage.columns.kind')}
          rows={report.assets}
          names="usage.assetKinds"
        />
      )}
    </div>
  )
}
