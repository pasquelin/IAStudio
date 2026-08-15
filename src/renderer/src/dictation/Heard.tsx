import { useTranslation } from 'react-i18next'
import { cn } from '@/helpers/cn'
import { useDictation } from '@/stores/dictation'

export type HeardProps = {
  /**
   * What stands in before a first word has been heard, in place of "Listening…".
   *
   * For a host whose words do not go to the caret: the assistant claims them while it is up, and
   * a microphone that only says it is open leaves "to whom" unanswered.
   */
  label?: string
  className?: string
}

/**
 * The sentence as it is still being weighed — the one thing that proves it is hearing, which no
 * indicator can give.
 *
 * A component of its own, and that is the whole reason it exists: the hypothesis is replaced
 * several times a second, and subscribing to it from any of its three hosts would re-render that
 * host at the speed of speech — the assistant's whole thread, or the four other indicators of the
 * status line. Written once because those three had it, and one of them had already drifted.
 *
 * Not a live region: each hypothesis is the whole sentence so far rather than a delta, so a reader
 * announcing them politely falls further behind the voice with every pass.
 */
export function Heard({ label, className }: HeardProps = {}) {
  const { t } = useTranslation()
  const heard = useDictation(store => store.partial)

  return (
    <p aria-live="off" className={cn('text-muted m-0 italic', className)}>
      {heard || label || t('dictation.listening')}
    </p>
  )
}
