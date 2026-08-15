import { mdiCheckCircleOutline, mdiAlertOutline } from '@mdi/js'
import { useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { Toast, ToastStack } from '@/design/Toast'
import { HINT_TOP } from '@/helpers/tooltip'
import { useAssistant } from '@/stores/assistant'

/**
 * How long an answer stands before it takes itself away.
 *
 * It expires, where `ActivityToasts` deliberately does not, and the difference is who asked: that
 * one carries a warning nobody was waiting for — an account switched under a project — so fading
 * it means someone looking at their canvas never saw it. This one answers a sentence the person
 * SPOKE a moment ago, at the screen they are watching precisely because they are waiting for it.
 *
 * Long enough to read a truncated sentence and reach for it, short enough not to sit over the
 * document.
 */
const LINGER_MS = 6000

/**
 * What became of the sentence, once, where the eye already is.
 *
 * The event half of talking without the window: `AssistantStatus` says the studio is working on
 * it, and this says how it ended. Both exist because the window is deliberately not opened by
 * speaking — one talks to the studio in order to WATCH it act, and a modal over the screen hides
 * the very thing the sentence was about.
 *
 * Its own surface rather than an entry in `ActivityToasts`, which is written for failures and
 * warnings and says so: a toast for every ordinary success trains the eye to look away from the
 * corner where the real problems appear. It wears `MENU_SURFACE` all the same, which is what that
 * file wears too — one floating look, wherever it hangs.
 */
export function AssistantToast() {
  const { t } = useTranslation()
  const open = useAssistant(state => state.open)
  const busy = useAssistant(state => state.busy)
  const seen = useAssistant(state => state.seen)
  // Three primitives rather than the turn itself: `patch` rebuilds that object by spread on every
  // step of a plan, so a selector returning it fails zustand's equality each time and re-renders
  // this whole file several times per sentence — for a component that shows nothing until the
  // plan is over.
  const id = useAssistant(state => state.turns.at(-1)?.id ?? 0)
  const said = useAssistant(state => state.turns.at(-1)?.said ?? '')
  const lost = useAssistant(state => state.turns.at(-1)?.lost ?? false)

  const showing = !open && !busy && id > seen

  useEffect(() => {
    if (!showing) return

    const timer = setTimeout(() => useAssistant.getState().markSeen(), LINGER_MS)
    return () => clearTimeout(timer)
    // Restarted per turn: two sentences in a row must not have the second inherit the first's
    // remaining time, which would flash it and take it away.
  }, [showing, id])

  if (!showing) return null

  return (
    <ToastStack>
      <Toast
        icon={lost ? mdiAlertOutline : mdiCheckCircleOutline}
        tone={lost ? 'text-warning' : 'text-success'}
        // The activity toasts' own word for the same gesture: one label, so a reader meets the
        // same button twice rather than two that differ by a synonym.
        dismissLabel={t('activity.dismiss')}
        dismissHint={t('assistant.dismissHint')}
        onDismiss={() => useAssistant.getState().markSeen()}
      >
        <button
          type="button"
          {...HINT_TOP(t('assistant.reviewHint'))}
          onClick={() => useAssistant.getState().show()}
          className="min-w-0 flex-1 cursor-pointer border-none bg-transparent text-left"
        >
          <span className="text-text block text-xs">
            {lost ? t('assistant.lost') : t('assistant.done')}
          </span>
          {/* The sentence as it left. Truncated, because a spoken request has no length limit —
              and what one is checking is the first few words, which are the ones a microphone
              gets wrong. */}
          <span className="text-muted text-mini block truncate italic">{said}</span>
        </button>
      </Toast>
    </ToastStack>
  )
}
