import { mdiAlertCircleOutline, mdiClose } from '@mdi/js'
import { useTranslation } from 'react-i18next'
import { UiIcon } from '@/design/UiIcon'
import { cn } from '@/helpers/cn'
import { useActivity } from '@/stores/activity'

/**
 * Failures, said out loud once.
 *
 * Written on the design system rather than on `react-toastify`: a toast is a floating panel of
 * this studio, and a library would bring its own surface, its own radius and its own animation
 * to fight the tokens with — the same reason a dock never holds a DaisyUI control.
 *
 * Only failures. An information line is what the journal is for; a toast for every asset
 * imported would train the user to look away from the corner where the failures appear.
 *
 * They do not expire. A toast that faded after four seconds is one a user who was looking at
 * their canvas never saw — and it is dismissing it that marks it read, not waiting.
 */
export function ActivityToasts() {
  const { t } = useTranslation()
  const unread = useActivity(state => state.unread)

  if (unread.length === 0) return null

  return (
    <div
      // Above the docks and out of the way of the status line, which is where the count lives.
      className="pointer-events-none fixed right-3 bottom-9 z-50 flex w-80 flex-col gap-1.5"
      role="status"
      aria-live="polite"
    >
      {unread.map(entry => (
        <div
          key={entry.id}
          className={cn(
            'border-border bg-surface pointer-events-auto flex items-start gap-2 border p-2',
            'rounded-(--radius-sc-lg) shadow-(--sc-shadow-floating)',
          )}
        >
          <UiIcon path={mdiAlertCircleOutline} size={14} className="text-danger mt-px shrink-0" />

          <div className="flex min-w-0 flex-1 flex-col gap-0.5">
            <span className="text-text text-[11px] break-words">
              {t(entry.messageKey, entry.params)}
            </span>
            {entry.detail && (
              <span className="text-muted/70 font-mono text-[10px] break-all">{entry.detail}</span>
            )}
          </div>

          <button
            type="button"
            aria-label={t('activity.dismiss')}
            onClick={() => useActivity.getState().dismiss(entry.id)}
            className="text-muted hover:text-text shrink-0 cursor-pointer border-none bg-transparent"
          >
            <UiIcon path={mdiClose} size={12} />
          </button>
        </div>
      ))}
    </div>
  )
}
