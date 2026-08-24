import { mdiChatOutline } from '@mdi/js'
import { useEffect, useRef, type Ref } from 'react'
import { useTranslation } from 'react-i18next'
import { ASSISTANT_MODELS } from '@shared/domain/assistant'
import { Button } from '@/design/Button'
import { EmptyState } from '@/design/EmptyState'
import { QuietNote } from '@/design/QuietNote'
import { fieldHandle } from '@/design/scHandle'
import { SelectField } from '@/design/SelectField'
import { Spinner } from '@/design/Spinner'
import { cn } from '@/helpers/cn'
import { isComposing } from '@/helpers/composition'
import { AI_SECTION } from '@/helpers/aiSectionLazy'
import { HINT_TOP, TIP_TOP } from '@/helpers/tooltip'
import { useAssistantOffer } from '@/hooks/useAssistantOffer'
import { useAssistant } from '@/stores/assistant'
import { useDictation } from '@/stores/dictation'
import { useLayouts } from '@/stores/layouts'
import { useSettings } from '@/stores/settings'
import { DictationButton } from '@/dictation/DictationButton'
import { Heard } from '@/dictation/Heard'
import { ASSISTANT_STARTERS, starterKey } from '../starters'
import { AssistantConversationQuestion } from './AssistantConversationQuestion'
import { AssistantConversationTurn } from './AssistantConversationTurn'
import { CONVERSATION_CARD } from './conversationStyles'

export type AssistantConversationProps = {
  /** The conversation column, so a host can dismiss on a press outside THIS and not its scrim. */
  ref?: Ref<HTMLDivElement>
  /** The modal asks for the caret; the idle centre must not, or it eats every studio shortcut. */
  autoFocus?: boolean
  /**
   * Whether this host has claimed the spoken word. The microphone goes where the claim is: shown
   * without one, a settled sentence falls to the caret — which the button itself just took.
   */
  voice?: boolean
}

/**
 * The conversation: what has been said, what is asked, and the place one writes. Two hosts, one
 * store, one thread. 🛑 Claims nothing — the confirmer, ⌘K and the spoken word belong to the
 * overlay, which is up as long as the shell is.
 */
export function AssistantConversation({ ref, autoFocus, voice }: AssistantConversationProps) {
  const { t } = useTranslation()
  const turns = useAssistant(state => state.turns)
  const busy = useAssistant(state => state.busy)
  const asked = useAssistant(state => state.asked)
  const micOpen = useDictation(store => store.state === 'listening')
  const model = useSettings(state => state.settings.assistant.model)
  const draft = useAssistant(state => state.draft)
  const setDraft = useAssistant(state => state.setDraft)
  const workspace = useLayouts(state => state.activeWorkspace)
  const offer = useAssistantOffer()
  const openSection = useSettings(state => state.openSection)

  const thread = useRef<HTMLOListElement>(null)
  /**
   * Whether the thread was at its end when the last turn arrived.
   *
   * Kept so that reading back through the conversation is not undone by the answer that lands
   * while one is reading: the thread follows the newest line only for someone already there.
   */
  const following = useRef(true)
  const field = useRef<HTMLTextAreaElement>(null)

  /**
   * Follows the newest line, but only for someone who was already at it.
   *
   * Unconditional, it yanked the thread back down every time an answer landed — including while
   * one was reading an earlier exchange, which is exactly when an answer lands.
   */
  const rememberScroll = (): void => {
    const list = thread.current
    if (!list) return
    // A few pixels of tolerance: a thread scrolled to its end lands a fraction short of the
    // arithmetic often enough that an exact comparison answers "not at the end" for good.
    following.current = list.scrollHeight - list.scrollTop - list.clientHeight < SCROLL_SLACK
  }

  useEffect(() => useAssistant.getState().stage(), [])

  useEffect(() => {
    const list = thread.current
    if (list && following.current) list.scrollTop = list.scrollHeight
  }, [turns])

  // 🛑 Never the whole conversation. `registerConfirmer` answers for MCP actions too, which need
  // no assistant model — swallowing the thread here left a question on screen that could not be
  // read, granted, or priced.
  const unserved = offer === 'unserved'

  const send = (): void => {
    // Sending is asking to see the answer. Without this, one trip up the thread to reread an
    // earlier exchange turned the following off for the rest of the session — every later reply
    // then landed out of sight, with nothing on screen saying why.
    following.current = true
    void useAssistant.getState().say(draft)
    // Here rather than in `say`, which also serves dictation: that path sends the SPOKEN words,
    // and emptying the field there destroyed whatever was half-typed beside them.
    setDraft('')
  }

  return (
    // Centred while there is nothing to read, so the first sentence is written where the eye
    // already is rather than at the foot of an empty page.
    <div
      ref={ref}
      className={cn(
        'mx-auto flex min-h-0 w-full max-w-3xl flex-1 flex-col gap-4 p-4',
        turns.length === 0 && 'justify-center',
      )}
    >
      {turns.length === 0 ? (
        // Nothing to invite with while nothing can answer: the call below says what to do instead.
        !unserved && <QuietNote standalone>{t('assistant.empty')}</QuietNote>
      ) : (
        <ol
          ref={thread}
          onScroll={rememberScroll}
          // No bar: a thread reads as a page of words, and one down its side turns it back
          // into a scrolling box. Elsewhere in the studio the bar is information.
          className="m-0 flex min-h-0 flex-1 scrollbar-none list-none flex-col gap-3 overflow-y-auto p-0"
        >
          {turns.map(turn => (
            <AssistantConversationTurn key={turn.id} turn={turn} />
          ))}
        </ol>
      )}

      {busy && !asked && (
        <Spinner label={t('assistant.thinking')} size={16} className="text-muted shrink-0" />
      )}

      {asked && <AssistantConversationQuestion request={asked.request} />}

      {/* The running hypothesis, above the field it will land in. The label is what makes it
          this window's: it says where the words are going, which "Listening…" does not — the
          same microphone dictates into a prompt. */}
      {voice && micOpen && (
        <Heard label={t('assistant.listening')} className="shrink-0 px-2 text-xs" />
      )}

      {unserved ? (
        // The composer alone, never the thread above it: what is missing is something to ANSWER,
        // and a question already on screen still has to be readable and grantable.
        <EmptyState
          icon={mdiChatOutline}
          message={t('assistant.unserved')}
          action={{
            // The studio's own word for this gesture: written again it drifted in English on
            // the first try, and the bundle guard said so.
            label: t('generation.chooseModel'),
            hint: t('assistant.chooseModelHint'),
            onClick: () => openSection(AI_SECTION),
          }}
        />
      ) : (
        <>
          {/* One block, and everything that composes a sentence lives INSIDE it: the field, the
            model it will be read by, the microphone and the send. They were a row of separate
            controls beside a one-line input, which read as a form rather than as the place one
            talks. */}
          <form
            className={CONVERSATION_CARD}
            onSubmit={event => {
              event.preventDefault()
              send()
            }}
          >
            {/* A textarea rather than a line: one SPEAKS to this window, and a spoken request runs
              long — dictated into a single line it scrolled sideways under the caret, with the
              beginning of one's own sentence out of sight. No field chrome of its own, since the
              block around it is the field. */}
            <textarea
              ref={field}
              // The one field of the studio a client most wants to fill, and it had no name a
              // script could reach: the guard reads per FILE, and the model picker below it answers.
              data-sc={fieldHandle('assistant.draft')}
              rows={3}
              value={draft}
              placeholder={t('assistant.placeholder')}
              // The platform's own, rather than an effect that could never fire twice: the value is
              // constant per host.
              autoFocus={autoFocus}
              // While a plan is running: a second sentence would interleave two plans over one
              // generator form, and the question on screen belongs to the first of them.
              disabled={busy}
              onChange={event => setDraft(event.target.value)}
              // Enter still sends, as it did when this was one line: a textarea's own default would
              // have made the keyboard path to sending disappear. Shift+Enter is the new line.
              onKeyDown={event => {
                // While an input method composes, Enter picks the candidate character — see
                // `isComposing`. Sending here would cut the word being written.
                if (event.key !== 'Enter' || event.shiftKey || isComposing(event)) return
                event.preventDefault()
                send()
              }}
              className="text-text w-full resize-none border-none bg-transparent px-1 text-base"
            />

            <div className="flex items-center gap-2">
              {/* Down here from the header, beside the sentence it will read: the moment one wants
                a better model is the middle of writing, not a trip to a title bar. */}
              <SelectField
                layout="inline"
                label={t('assistant.model')}
                scId="assistant.model"
                hint={TIP_TOP(t('assistant.model'), false, t('assistant.modelHint'))}
                value={model}
                // Named from the bundle, never from the union: a raw `gemini-3.5-flash` in an
                // otherwise French list is the defect this repository pays for most.
                options={ASSISTANT_MODELS.map(name => ({
                  value: name,
                  label: t(`assistant.models.${name}`),
                }))}
                onChange={name => useAssistant.getState().setModel(name)}
                className="max-w-44"
              />

              {/* Beside the button it shares a job with: this pair is "how the sentence gets in". */}
              <span className="ml-auto flex items-center gap-2">
                {voice && <DictationButton variant="header" tooltip={TIP_TOP} />}

                <Button
                  type="submit"
                  variant="primary"
                  disabled={busy || draft.trim() === ''}
                  {...HINT_TOP(t('assistant.sendHint'))}
                >
                  {t('assistant.send')}
                </Button>
              </span>
            </div>
          </form>

          {/* Only over a blank thread, and only what the section at hand can actually be asked for:
            a suggestion beside an exchange is an interruption, and one about pictures in a timeline
            is noise. They WRITE the sentence rather than sending it — see `ASSISTANT_STARTERS`. */}
          {turns.length === 0 && (
            <div className="flex shrink-0 flex-wrap justify-center gap-2">
              {ASSISTANT_STARTERS[workspace].map(starter => {
                const sentence = t(starterKey(starter))

                return (
                  <Button
                    key={starter}
                    {...HINT_TOP(t('assistant.starterHint'))}
                    onClick={() => {
                      setDraft(sentence)
                      field.current?.focus()
                    }}
                  >
                    {sentence}
                  </Button>
                )
              })}
            </div>
          )}
        </>
      )}
    </div>
  )
}

/**
 * How close to the end still counts as being at it, in pixels.
 *
 * Not a design value: it is the tolerance of an arithmetic comparison, and a thread scrolled all
 * the way down lands a fraction short of `scrollHeight` often enough that an exact test answers
 * "the reader has scrolled away" for the rest of the conversation.
 */
const SCROLL_SLACK = 24
