import { mdiClose } from '@mdi/js'
import { useEffect, useRef } from 'react'
import { useTranslation } from 'react-i18next'
import { ToolButton } from '@/design/ToolButton'
import { TIP_LEFT } from '@/helpers/tooltip'
import { useDismiss } from '@/hooks/useDismiss'
import { useAssistant } from '@/stores/assistant'
import { useDictation } from '@/stores/dictation'
import { formatUnits } from '@/helpers/format'
import { registerDictationTarget } from '@/dictation/destination'
import { AssistantConversation } from '../AssistantConversation/AssistantConversation'
import { registerChatPanel } from '../chatPanel'
import { registerConfirmer } from '../confirm'

/**
 * The assistant, as a modal over the whole window.
 *
 * Mounted once by the shell rather than by a panel, for two reasons that both come down to the
 * same thing: it is the studio one talks to, not a dock — and it is where a question gets asked
 * before anything is spent, including a question raised from outside this window. A panel that
 * happened to be closed would mean no one could be asked.
 *
 * What it stages is `AssistantConversation`, which the empty centre stages too. Everything here is the
 * STAGING and the three claims — the window's confirmer, ⌘K, and the spoken word — which belong
 * to the one surface that is up for as long as the shell is.
 */
export function AssistantOverlay() {
  const { t, i18n } = useTranslation()
  const open = useAssistant(state => state.open)
  const asked = useAssistant(state => state.asked)
  const spent = useAssistant(state => state.spent)
  const hide = useAssistant(state => state.hide)

  const surface = useRef<HTMLDivElement>(null)

  // For as long as the shell is up, and only from here: a confirmation shown where nobody is
  // looking is not a confirmation.
  useEffect(() => registerConfirmer(useAssistant.getState().ask), [])

  // The same arrangement for `⌘K`, which the router fires without being able to import the store.
  useEffect(() => registerChatPanel({ toggle: useAssistant.getState().toggle }), [])

  // A question is answered, never walked away from: Escape and a press outside would otherwise
  // leave the action that raised it waiting for an answer that can no longer come.
  useDismiss(open && !asked ? hide : undefined, surface)

  /**
   * The spoken word, whether or not this window is showing.
   *
   * Claimed from here rather than branched on inside the dictation session, which knows nothing
   * about this modal. Not a caret inside it either: one dictates with the hands off the keyboard,
   * so asking for a focused field would make the voice path unreachable by voice.
   *
   * **Declared before the microphone's effect below, and that is the whole ordering.** React runs
   * effects in the order they are written, so the words are claimed before anything opens a
   * stream — a sentence settling with no target goes to the caret, and that is the defect these
   * two entries exist to remove.
   */
  useEffect(() => {
    if (!open) return

    return registerDictationTarget(text => {
      const assistant = useAssistant.getState()
      // While a plan is running the assistant takes no new sentence — but the words were spoken,
      // and dropping them left no trace at all: not sent, not inserted at the caret (the claim
      // above short-circuits that), nothing on screen. They land in the field instead, where
      // they wait exactly as typed ones do.
      if (assistant.busy) {
        assistant.setDraft(assistant.draft === '' ? text : `${assistant.draft} ${text}`)
        return
      }

      void assistant.say(text)
    })
  }, [open])

  /**
   * And the session ends with the claim.
   *
   * Its own effect rather than a line inside the cleanup above, because the two answer different
   * questions and one of them is conditional: giving the words back is unconditional, closing a
   * microphone is not — a window dismissed while nothing was being said has none to close, and
   * `stop()` would still cross to the main process on every dismissal.
   *
   * Measured on screen, not deduced: closing the window over a live microphone used to leave it
   * running, and the next sentence went to the caret with the status line quietly changing to
   * "dictating to the field".
   */
  useEffect(() => {
    if (!open) return
    return endSession
  }, [open])

  if (!open) return null

  return (
    // Black and nearly opaque, and that is the whole staging: this is not a box laid on the studio
    // but a conversation held OVER it, with the application sunk to a backdrop behind the words.
    // The blur is what keeps it a backdrop rather than a wall — one can still tell the studio is
    // under there. It blurs the layer BEHIND this element, so the window itself stays opaque:
    // the rule against vibrancy is about judging colours in the studio, and nothing is being
    // judged while this is up.
    <div className="bg-scrim-deep fixed inset-0 z-50 flex justify-center p-8 backdrop-blur-lg">
      <div
        // Still a dialog for anyone not looking at it: Escape closes, focus goes to the field, and
        // the studio behind is out of reach. What changed is the chrome, not the behaviour.
        role="dialog"
        aria-modal="true"
        aria-label={t('assistant.title')}
        // No border, no panel fill, no shadow: nothing frames it, because there is no box. The
        // room of a conversation, since the thread is what one reads here — a container the height
        // of its content put five exchanges behind a scrollbar with two thirds of the window empty.
        className="flex h-full w-full flex-col gap-3"
      >
        {/* No title: the window carries one for a screen reader (`aria-label` above) and nothing
            else needs telling — a conversation one just opened is not a thing to label. What is
            left is what one may want mid-sentence: what it has cost, and the way out. */}
        <header className="flex shrink-0 items-center justify-end gap-2">
          <output className="text-muted text-mini tabular-nums">
            {t('units.creative', { units: formatUnits(spent, i18n.language) })}
          </output>

          <ToolButton
            icon={mdiClose}
            label={t('assistant.close')}
            description={t('assistant.closeHint')}
            tooltip={TIP_LEFT}
            variant="header"
            onClick={hide}
          />
        </header>

        <AssistantConversation ref={surface} autoFocus voice />
      </div>
    </div>
  )
}

/**
 * Ends the dictation session, if one is running.
 *
 * Shared by the two effects that can end it — the words being given back, and the microphone this
 * window opened itself — because they are the same gesture twice. Guarded rather than
 * unconditional: a window dismissed while nothing was being said has no session to close, and
 * `stop()` would still cross to the main process on every dismissal.
 */
function endSession(): void {
  if (useDictation.getState().state === 'listening') void useDictation.getState().stop()
}
