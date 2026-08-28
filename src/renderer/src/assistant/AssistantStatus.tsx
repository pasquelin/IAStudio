import { useTranslation } from 'react-i18next'
import { Spinner } from '@/design/Spinner'
import { useAssistant } from '@/stores/assistant'

/**
 * That the assistant is working on the sentence just spoken.
 *
 * Half of what talking without the window was missing: the sentence went and nothing said it had
 * been TAKEN — one knew only that one had spoken. The other half is what came back, which is an
 * event rather than a state and belongs to `AssistantToast`.
 *
 * A state, so the status line: this is where a running generation reports from, and it reads the
 * same way. It echoes the sentence back, which is the point of it rather than a decoration —
 * what one needs to see after speaking is that THESE words, and not some other transcription of
 * them, are the ones that left.
 */
export function AssistantStatus() {
  const { t } = useTranslation()
  const staged = useAssistant(state => state.staged > 0)
  const busy = useAssistant(state => state.busy)
  const said = useAssistant(state => state.turns.at(-1)?.said ?? '')

  // Nothing while a surface has the thread up — the right column or the empty centre: it says
  // all of this at
  // length already, with its own spinner.
  if (staged || !busy || said === '') return null

  return (
    <span className="flex items-center gap-1.5">
      <Spinner label={t('assistant.thinking')} size={12} />
      {/* Capped and truncated: the line has no width to give — four other indicators share its
          end, and a spoken request has no length limit. */}
      <span className="text-muted max-w-48 truncate italic">{said}</span>
    </span>
  )
}
