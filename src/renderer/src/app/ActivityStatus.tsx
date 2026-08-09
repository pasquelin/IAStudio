import { mdiAlertCircleOutline, mdiHistory } from '@mdi/js'
import { useCallback, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Flyout } from '@/design/Flyout'
import { UiIcon } from '@/design/UiIcon'
import { STATUS_BUTTON } from '@/design/styles'
import { failureCount, useActivity } from '@/stores/activity'
import { ActivityList } from './ActivityList'

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
  const close = useCallback(() => setOpen(false), [])

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
        className={STATUS_BUTTON}
      >
        <UiIcon path={failures > 0 ? mdiAlertCircleOutline : mdiHistory} size={12} />
        {failures > 0 && (
          <span className="text-danger">{t('activity.failures', { count: failures })}</span>
        )}
      </button>

      {open && (
        <Flyout anchor={anchor} placement="above" onDismiss={close}>
          <div className="flex h-80 w-96 flex-col">
            <ActivityList />
          </div>
        </Flyout>
      )}
    </>
  )
}
