import { mdiClose } from '@mdi/js'
import { useTranslation } from 'react-i18next'
import { ToolButton } from '@/design/ToolButton'
import { UiIcon } from '@/design/UiIcon'
import { MENU_SURFACE } from '@/design/styles'
import { cn } from '@/helpers/cn'
import { useActivity } from '@/stores/activity'
import { ActivityMessage, GLYPHS, TINTS } from './ActivityList'
import { TIP_LEFT } from '@/helpers/tooltip'

/**
 * Failures and warnings, said out loud once.
 *
 * Written on the design system rather than on `react-toastify`: a toast is a floating panel of
 * this studio, and a library would bring its own surface, its own radius and its own animation
 * to fight the tokens with — the same reason a dock never holds a DaisyUI control.
 *
 * Never information. A toast for every asset imported would train the user to look away from the
 * corner where the failures appear — but a warning is precisely a thing one has to be looking to
 * catch: switching accounts changes which remote library a project reads, and the journal is not
 * open at the moment one does it.
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
          // The id is a rowid of the OPEN project's catalogue, so it restarts at 1 for each one:
          // two projects opened in a row can raise toasts sharing an id. The instant tells them
          // apart, and React needs the pair to stop reusing one row's node for the other.
          key={`${entry.at}-${entry.id}`}
          // The same surface a menu wears, minus its layout: one floating look, wherever it hangs.
          className={cn(MENU_SURFACE, 'pointer-events-auto static flex-row items-start gap-2 p-2')}
        >
          <UiIcon
            path={GLYPHS[entry.level]}
            size={14}
            className={cn('mt-px shrink-0', TINTS[entry.level])}
          />
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
