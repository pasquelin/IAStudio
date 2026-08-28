import { mdiChatOutline } from '@mdi/js'
import { useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Button } from '@/design/Button'
import { EmptyState } from '@/design/EmptyState'
import { QuietNote } from '@/design/QuietNote'
import { fieldHandle } from '@/design/scHandle'
import { PANEL_SCROLL } from '@/design/styles'
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
import { registerDictationTarget } from '@/dictation/destination'
import { DictationButton } from '@/dictation/DictationButton'
import { Heard } from '@/dictation/Heard'
import { registerChatPanel } from '../chatPanel'
import { ASSISTANT_STARTERS, starterKey } from '../starters'
import { AssistantConversationPicker } from './AssistantConversationPicker'
import { AssistantConversationQuestion } from './AssistantConversationQuestion'
import { AssistantConversationTurn } from './AssistantConversationTurn'
import { CONVERSATION_CARD } from './conversationStyles'

/**
 * The conversation: what has been said, what is asked, and the place one writes. Two hosts — the
 * right column's panel and the empty centre — one store, one thread, never both at once. It
 * claims the caret while mounted, the spoken word only while read; the confirmer is the shell's.
 *
 * 🛑 It FILLS what it is given, at the scale the docks read at: the width of a page and the type
 * of one belonged to the modal, and a column the reader can drag to 140 px does not have either.
 */
export function AssistantConversation() {
  const { t } = useTranslation()
  const turns = useAssistant(state => state.turns)
  const busy = useAssistant(state => state.busy)
  const round = useAssistant(state => state.round)
  const stopping = useAssistant(state => state.stopping)
  const stop = useAssistant(state => state.stop)
  const asked = useAssistant(state => state.asked)
  const micOpen = useDictation(store => store.state === 'listening')
  const draft = useAssistant(state => state.draft)
  const setDraft = useAssistant(state => state.setDraft)
  const workspace = useLayouts(state => state.activeWorkspace)
  const offer = useAssistantOffer()
  const openSection = useSettings(state => state.openSection)

  // Focus IN the block, not on the field: the microphone button is one of its children, and
  // pressing it must not hand the spoken word back to whatever the caret was in before.
  const [inside, setInside] = useState(false)
  /**
   * A session begun here and still running once the caret has moved on: one dictates with the
   * hands off the keyboard, so looking at the canvas mid-sentence must not hand the rest of the
   * sentence to whatever is under the pointer. It falls on its own when the microphone shuts.
   */
  const [speaking, setSpeaking] = useState(false)

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

  // ⌘K and the native menu reach the field through this, wherever the conversation stands. The
  // two hosts are never up together, so the last to mount is always the one on screen.
  useEffect(() => registerChatPanel({ focus: () => field.current?.focus() }), [])

  /**
   * The spoken word, and only for a reader who came HERE to speak. 🛑 Not for as long as the
   * panel is mounted: it is what an untouched right column draws, so an unconditional claim
   * would send every dictation of the studio here — the prompt of a generation included.
   */
  const heard = inside || (speaking && micOpen)
  useEffect(() => {
    useAssistant.setState({ hearing: heard })
    if (!heard) return

    return registerDictationTarget(text => {
      const assistant = useAssistant.getState()
      // While a plan is running the assistant takes no new sentence — but the words were spoken,
      // and dropping them left no trace at all. They land in the field instead.
      if (assistant.busy) {
        assistant.setDraft(assistant.draft === '' ? text : `${assistant.draft} ${text}`)
        return
      }

      void assistant.say(text)
    })
  }, [heard])

  // Leaving over a live microphone used to leave it running, with the status line quietly
  // changing to "dictating to the field".
  useEffect(
    () => () => {
      useAssistant.setState({ hearing: false })
      if (useDictation.getState().state === 'listening') void useDictation.getState().stop()
    },
    [],
  )

  /**
   * 🛑 `round` and `asked` as well as `turns`: the working line is the LAST child of the thread
   * now, and it appears without a turn changing — a round starting, a confirmation granted. Kept
   * on `turns` alone it was appended below the fold, and the one thing saying "it is still
   * working" was the one thing out of sight.
   */
  useEffect(() => {
    const list = thread.current
    if (list && following.current) list.scrollTop = list.scrollHeight
  }, [turns, busy, round, asked])

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
    <div
      onFocus={() => setInside(true)}
      onBlur={event => {
        const stays = event.currentTarget.contains(event.relatedTarget)
        setInside(stays)
        if (!stays) setSpeaking(micOpen)
      }}
      className="flex min-h-0 w-full flex-1 flex-col gap-2 p-1"
    >
      {turns.length === 0 ? (
        // The room a thread would take, kept empty: the composer stays at the foot in both hosts,
        // where a chat puts it, rather than climbing to the top of a window with nothing in it.
        <div className="flex flex-1 flex-col justify-center">
          {/* Nothing to invite with while nothing can answer: the call below says what to do. */}
          {!unserved && <QuietNote standalone>{t('assistant.empty')}</QuietNote>}
        </div>
      ) : (
        <ol
          ref={thread}
          onScroll={rememberScroll}
          // 🛑 `pl-0` and never `p-0`: what is stripped is a list's own indent, and the right
          // padding of `PANEL_SCROLL` is the room the macOS overlay bar is drawn in — over the
          // bubbles, which are the one thing in the studio aligned to that edge.
          className={cn(PANEL_SCROLL, 'm-0 list-none gap-2 pl-0')}
        >
          {turns.map(turn => (
            <AssistantConversationTurn key={turn.id} turn={turn} />
          ))}

          {/* IN the thread, last of it — where the answer itself will appear, and never down by
              the field: what one watches while waiting is the place the words will land. */}
          {busy && !asked && (
            <li className="text-muted text-mini m-0 flex items-center gap-1.5">
              <Spinner label={t('assistant.thinking')} size={14} />
              {stopping
                ? t('assistant.stopping')
                : round > 1
                  ? t('assistant.workingRound', { round })
                  : t('assistant.thinking')}
            </li>
          )}
        </ol>
      )}

      {asked && <AssistantConversationQuestion request={asked.request} />}

      {/* The running hypothesis, above the field it will land in. The label is what makes it
          this window's: it says where the words are going, which "Listening…" does not — the
          same microphone dictates into a prompt. */}
      {micOpen && <Heard label={t('assistant.listening')} className="shrink-0 px-2 text-xs" />}

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
              className="text-text w-full resize-none border-none bg-transparent px-1 text-xs"
            />

            {/* Wrapping: the picker and the pair sit side by side wherever there is room and
                stack where there is not — one line could only shrink, and the picker has a
                floor. */}
            <div className="flex flex-wrap items-center gap-2">
              {/* Down here from the header, beside the sentence it will read: the moment one wants
                another brain is the middle of writing, not a trip to a preferences window. */}
              <AssistantConversationPicker />

              {/* Beside the button it shares a job with: this pair is "how the sentence gets in". */}
              <span className="ml-auto flex items-center gap-2">
                <DictationButton variant="header" tooltip={TIP_TOP} />

                {/* Where Send was, and never beside it: the same corner the eye already goes to
                    for "act on this", and a chain one cannot stop is one nobody dares start. */}
                {busy ? (
                  <Button
                    type="button"
                    onClick={stop}
                    disabled={stopping}
                    {...HINT_TOP(t('assistant.stopHint'))}
                  >
                    {t('assistant.stop')}
                  </Button>
                ) : (
                  <Button
                    type="submit"
                    variant="primary"
                    disabled={draft.trim() === ''}
                    {...HINT_TOP(t('assistant.sendHint'))}
                  >
                    {t('assistant.send')}
                  </Button>
                )}
              </span>
            </div>
          </form>

          {/* Only over a blank thread, and only what the section at hand can actually be asked for:
            a suggestion beside an exchange is an interruption, and one about pictures in a timeline
            is noise. They WRITE the sentence rather than sending it — see `ASSISTANT_STARTERS`. */}
          {turns.length === 0 && (
            <div className="flex shrink-0 flex-wrap gap-2">
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
