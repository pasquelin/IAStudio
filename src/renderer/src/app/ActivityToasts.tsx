import { useTranslation } from 'react-i18next'
import { Toast } from '@/design/Toast/Toast'
import { ToastStack } from '@/design/Toast/ToastStack'
import { useActivity } from '@/stores/activity'
import { ActivityListMessage } from './ActivityList/ActivityListMessage'
import { GLYPHS, TONES } from './ActivityList/activityLevels'

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
    <ToastStack>
      {unread.map(entry => (
        <Toast
          // The id is a rowid of the OPEN project's catalogue, so it restarts at 1 for each one:
          // two projects opened in a row can raise toasts sharing an id. The instant tells them
          // apart, and React needs the pair to stop reusing one row's node for the other.
          key={`${entry.at}-${entry.id}`}
          icon={GLYPHS[entry.level]}
          tone={TONES[entry.level]}
          dismissLabel={t('activity.dismiss')}
          onDismiss={() => useActivity.getState().dismiss(entry.id)}
        >
          <ActivityListMessage entry={entry} clamp={false} />
        </Toast>
      ))}
    </ToastStack>
  )
}
