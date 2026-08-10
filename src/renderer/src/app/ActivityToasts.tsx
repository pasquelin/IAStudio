import { mdiClose } from '@mdi/js'
import { useTranslation } from 'react-i18next'
import { ToolButton } from '@/design/ToolButton'
import { UiIcon } from '@/design/UiIcon'
import { MENU_SURFACE } from '@/design/styles'
import { cn } from '@/helpers/cn'
import { useActivity } from '@/stores/activity'
import { ActivityMessage, GLYPHS } from './ActivityList'
import { TIP_LEFT } from '@/helpers/tooltip'

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
          // The same surface a menu wears, minus its layout: one floating look, wherever it hangs.
          className={cn(MENU_SURFACE, 'pointer-events-auto static flex-row items-start gap-2 p-2')}
        >
          <UiIcon path={GLYPHS[entry.level]} size={14} className="text-danger mt-px shrink-0" />
          <ActivityMessage entry={entry} />

          <ToolButton
            icon={mdiClose}
            label={t('activity.dismiss')}
            tooltip={TIP_LEFT}
            variant="header"
            onClick={() => useActivity.getState().dismiss(entry.id)}
          />
        </div>
      ))}
    </div>
  )
}
