import { mdiAlertCircleOutline, mdiHistory } from '@mdi/js'
import { useTranslation } from 'react-i18next'
import { StatusFlyout } from '@/components/StatusFlyout'
import { UiIcon } from '@/components/UiIcon'
import { failureCount, useActivity } from '@/stores/activity'
import { ActivityList } from './ActivityList/ActivityList'

/**
 * The journal, in the status line rather than in a panel of its own.
 *
 * Never silent, unlike the generations: a studio that shows nothing until something breaks
 * leaves the user with nowhere to look BEFORE it does — which is the whole complaint the
 * journal answers.
 */
export function ActivityStatus() {
  const { t } = useTranslation()
  const failures = useActivity(failureCount)

  return (
    <StatusFlyout
      label={t('activity.open')}
      hint={t('activity.openHint')}
      // Opening it IS reading it: the toasts have said their piece by the time one gets here.
      onOpen={() => useActivity.getState().dismissAll()}
      face={
        <>
          <UiIcon path={failures > 0 ? mdiAlertCircleOutline : mdiHistory} size={12} />
          {failures > 0 && (
            <span className="text-danger">{t('activity.failures', { count: failures })}</span>
          )}
        </>
      }
      panel={
        <div className="flex h-80 w-96 flex-col">
          <ActivityList />
        </div>
      }
    />
  )
}
