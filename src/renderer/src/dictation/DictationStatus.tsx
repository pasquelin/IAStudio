import { mdiMicrophone } from '@mdi/js'
import { useTranslation } from 'react-i18next'
import { UiIcon } from '@/design/UiIcon'
import { useDictation } from '@/stores/dictation'

/**
 * Says that the microphone is on, wherever one happens to be looking.
 *
 * An application that records has to show it, and the button that started the session may be
 * behind a panel, in another workspace, or on a form the user has scrolled past — the status
 * line is the one place that is always in view.
 *
 * It reads the store directly rather than through `useDictation`: this is mounted for the whole
 * life of the window, and it has no session of its own to claim.
 */
export function DictationStatus() {
  const { t } = useTranslation()
  const listening = useDictation(state => state.state === 'listening')

  if (!listening) return null

  return (
    <span role="status" className="text-accent flex items-center gap-1.5">
      <UiIcon path={mdiMicrophone} size={12} />
      {t('dictation.active')}
    </span>
  )
}
