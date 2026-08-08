import { mdiAlertCircleOutline, mdiHistory } from '@mdi/js'
import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Flyout } from '@/design/Flyout'
import { UiIcon } from '@/design/UiIcon'
import { ActivityList } from '@/panels/activity/ActivityList'
import { cn } from '@/helpers/cn'
import { failureCount, useActivity } from '@/stores/activity'

/**
 * The journal, in the status line rather than in a panel of its own.
 *
 * Same reason as the generations beside it: what went wrong has to be readable from every
 * workspace, and a panel could only be in one. Here it costs no surface, and the full list is
 * one click away.
 *
 * Never silent, unlike the generations: a studio that shows nothing until something breaks
 * leaves the user with nowhere to look BEFORE it does — which is the whole complaint the
 * journal answers.
 */
export function ActivityStatus() {
  const { t } = useTranslation()
  const failures = useActivity(failureCount)
  const [anchor, setAnchor] = useState<HTMLButtonElement | null>(null)
  const [open, setOpen] = useState(false)

  useEffect(() => {
    let stop: (() => void) | undefined
    void useActivity
      .getState()
      .connect()
      .then(unsubscribe => {
        stop = unsubscribe
      })

    return () => stop?.()
  }, [])

  return (
    <>
      <button
        ref={setAnchor}
        type="button"
        aria-label={t('activity.open')}
        aria-expanded={open}
        onClick={() => {
          // Opening it IS reading it: the toasts have said their piece by the time one gets here.
          if (!open) useActivity.getState().dismissAll()
          setOpen(current => !current)
        }}
        className="hover:text-text flex items-center gap-1.5"
      >
        <UiIcon path={failures > 0 ? mdiAlertCircleOutline : mdiHistory} size={12} />
        {failures > 0 && (
          <span className={cn('text-danger')}>{t('activity.failures', { count: failures })}</span>
        )}
      </button>

      {open && (
        <Flyout anchor={anchor} placement="above">
          <div className="flex h-80 w-96 flex-col">
            <ActivityList />
          </div>
        </Flyout>
      )}
    </>
  )
}
