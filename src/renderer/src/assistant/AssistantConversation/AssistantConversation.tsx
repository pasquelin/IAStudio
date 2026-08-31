import { mdiChatOutline } from '@mdi/js'
import {
  useEffect,
  useId,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type KeyboardEvent,
} from 'react'
import { useTranslation } from 'react-i18next'
import { Button } from '@/components/Button'
import { EmptyState } from '@/components/EmptyState'
import { GhostText } from '@/components/GhostText'
import { QuietNote } from '@/components/QuietNote'
import { fieldHandle } from '@/components/scHandle'
import { PANEL_SCROLL } from '@/components/styles'
import { cn } from '@/helpers/cn'
import { isComposing } from '@/helpers/composition'
import { completionFor, foldForSearch, matchesWords, searchWords } from '@shared/text'
import { answeredByComposer } from '@shared/domain/assistant'
import { AI_SECTION } from '@/helpers/aiSectionLazy'
import { HINT_TOP, TIP_TOP } from '@/helpers/tooltip'
import { useAssistantDoor } from '@/hooks/useAssistantDoor'
import { useAssistantOffer } from '@/hooks/useAssistantOffer'
import { useShortcutLabel } from '@/hooks/useShortcutLabel'
import { useAssistant, type AssistantChoiceQuestion } from '@/stores/assistant'
import { useDictation } from '@/stores/dictation'
import { useToolSurface } from '@/stores/layouts'
import { useSettings } from '@/stores/settings'
import { registerDictationTarget } from '@/dictation/destination'
import { DictationButton } from '@/dictation/DictationButton'
import { Heard } from '@/dictation/Heard'
import { registerChatPanel } from '../chatPanel'
import { ASSISTANT_STARTERS, starterKey } from '../starters'
import { AssistantConversationSuggestions, suggestionId } from './AssistantConversationSuggestions'
import { AssistantConversationPicker } from './AssistantConversationPicker'
import { AssistantConversationChoice } from './AssistantConversationChoice'
import { AssistantConversationGauge } from './AssistantConversationGauge'
import { AssistantConversationQuestion } from './AssistantConversationQuestion'
import { AssistantConversationTurn } from './AssistantConversationTurn'
import { AssistantConversationWorking } from './AssistantConversationWorking'
import { CONVERSATION_CARD, CONVERSATION_FIELD_TYPE } from './conversationStyles'

/** Whether the caret sits past the last character, which is the only place a tail is painted. */
const atEnd = (field: HTMLTextAreaElement): boolean => field.selectionStart === field.value.length

/** The two travel together: taking the tail writes the studio's spelling, not the hand's. */
function tailOf(
  sentence: string | undefined,
  draft: string,
): { sentence: string; tail: string } | undefined {
  if (sentence === undefined) return undefined

  const tail = completionFor(sentence, draft)
  return tail === undefined ? undefined : { sentence, tail }
}

/** Whether what is typed — or spoken — is the answer to the question standing. */
const typedInto = (choosing: AssistantChoiceQuestion | null): boolean =>
  choosing !== null && answeredByComposer(choosing.questions)

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
  // `useId` and not a module constant: two hosts never mount at once today, and an id that
  // assumed it would be a broken `aria-activedescendant` the day one does.
  const listId = useId()
  const turns = useAssistant(state => state.turns)
  const busy = useAssistant(state => state.busy)
  const round = useAssistant(state => state.round)
  const stop = useAssistant(state => state.stop)
  // Two writes per chain, not sixty a second — unlike the tail, which left with the working line.
  const stopping = useAssistant(state => state.stopping)
  const asked = useAssistant(state => state.asked)
  const choosing = useAssistant(state => state.choosing)
  // 🛑 The exception to "a plan is running, the field is shut": ONE question with nothing to press
  // is answered by typing. A questionnaire is answered in its own card, so the field shuts again.
  const typing = typedInto(choosing)
  const micOpen = useDictation(store => store.state === 'listening')
  const draft = useAssistant(state => state.draft)
  const setDraft = useAssistant(state => state.setDraft)
  const surface = useToolSurface()
  const offer = useAssistantOffer()
  useAssistantDoor()
  const openSection = useSettings(state => state.openSection)
  const keyLabel = useShortcutLabel()

  // Focus IN the block, not on the field: the microphone button is one of its children, and
  // pressing it must not hand the spoken word back to whatever the caret was in before.
  const [inside, setInside] = useState(false)
  /**
   * A session begun here and still running once the caret has moved on: one dictates with the
   * hands off the keyboard, so looking at the canvas mid-sentence must not hand the rest of the
   * sentence to whatever is under the pointer. It falls on its own when the microphone shuts.
   */
  const [speaking, setSpeaking] = useState(false)

  /**
   * What one can ask, narrowed by what is being written. Nothing while the field is empty: the
   * list is an ANSWER to typing, and one that opened on six sentences nobody asked for is the
   * two rows of chips this replaced.
   */
  const matches = useMemo(() => {
    const words = searchWords(draft)
    if (words.length === 0) return []

    const written = foldForSearch(draft.trim())
    // Folded on BOTH sides, as the match is: compared raw, a sentence typed without its accents
    // stayed offered as though it were something else.
    return ASSISTANT_STARTERS[surface]
      .map(starter => t(starterKey(starter)))
      .filter(one => matchesWords(one, words) && foldForSearch(one) !== written)
  }, [draft, surface, t])

  /** Which match is held. The FIRST by default: a tail nobody asked for is one nobody would see. */
  const [rank, setRank] = useState(0)
  const [given, setGiven] = useState(false)
  const [walked, setWalked] = useState(matches)
  /** The tail is painted after what is written, so it is only offered from there. */
  const [caretAtEnd, setCaretAtEnd] = useState(true)
  // 🛑 The FIELD's focus, not the block's: `inside` stays true for the model picker below, and a
  // tail advertising Tab there is a key that no longer takes it.
  const [writing, setWriting] = useState(false)

  /**
   * 🛑 A rebuilt list gives the rank back, whatever rebuilt it — a keystroke, a change of space,
   * a language, a dictated word appended from elsewhere. Kept, rank 5 named one sentence and then
   * another, highlighted and silently different, and Tab took the second.
   */
  if (walked !== matches) {
    setWalked(matches)
    setRank(0)
    setGiven(false)
  }

  const shown = !given && !busy ? matches : []
  // `matches` trims and the tail cannot: the mirror paints `draft` verbatim, so a leading space
  // kills the tail and keeps the rows.
  const spelled = caretAtEnd ? tailOf(shown[rank], draft) : undefined
  // Painted only while one writes HERE — but `listed` reads `spelled`, or clicking the picker
  // below opened a one-row list under the hand that had just left.
  const ghost = writing ? spelled : undefined

  // A tail already spells this one out: the lone bordered row read as a button to press.
  const listed = spelled !== undefined && shown.length === 1 ? [] : shown

  /**
   * The list opens UPWARD, so the row nearest the caret is the LAST one drawn: rank 0 — the best
   * match, and the one the tail spells out — sits at the bottom, against the field one writes in.
   */
  const rows = [...listed].reverse()
  const heldRow = listed.length - 1 - rank

  // Taken means WRITTEN, never sent: the sentence is a start, and what one adds to it — a name,
  // a size, a folder — is the half the studio cannot guess.
  const take = (sentence: string): void => {
    setDraft(sentence)
    setCaretAtEnd(true)
    field.current?.focus()
  }

  /**
   * 🛑 Enter takes nothing: a match is held from the first keystroke, and an Enter that took it
   * would send a sentence the hand never finished. Escape is the way OUT — Tab is taken here.
   */
  const steer = (event: KeyboardEvent<HTMLTextAreaElement>): boolean => {
    if (shown.length === 0 || isComposing(event)) return false

    // 🛑 Read from the event, never from `caretAtEnd`: a focus given by ⌘K refreshes neither of
    // the two handlers that fill it, and a stale one let the right arrow overwrite a draft from
    // its first character. A BARE Tab, too — Shift+Tab means "go back", and took the tail.
    const bare = !event.shiftKey && !event.ctrlKey && !event.altKey && !event.metaKey
    if (ghost !== undefined && bare && atEnd(event.currentTarget)) {
      if (event.key === 'Tab' || event.key === 'ArrowRight') {
        take(ghost.sentence)
        return true
      }
    }

    if (event.key === 'Escape') {
      setGiven(true)
      return true
    }

    /**
     * ↑ walks INTO the list above, ↓ comes back down — and only from the end of a draft holding
     * no newline, or a walk would confiscate the way through a dictated paragraph.
     *
     * **Blind to WRAP**: a long single line that wraps loses ↑ too. No sentence that long matches
     * a starter, so no list is up when it would matter.
     */
    const walks = atEnd(event.currentTarget) && !draft.includes('\n')

    // `listed`, not `shown`: a lone match the tail spells out draws no rows, and an arrow that
    // walked it moved nothing anyone could see.
    if (walks && listed.length > 1 && (event.key === 'ArrowUp' || event.key === 'ArrowDown')) {
      setRank(at => (at + (event.key === 'ArrowUp' ? 1 : -1) + listed.length) % listed.length)
      return true
    }

    return false
  }

  const thread = useRef<HTMLOListElement>(null)
  /**
   * Whether the thread was at its end when the last turn arrived.
   *
   * Kept so that reading back through the conversation is not undone by the answer that lands
   * while one is reading: the thread follows the newest line only for someone already there.
   */
  const following = useRef(true)
  const field = useRef<HTMLTextAreaElement>(null)
  /** Followed to the field's own scroll: a tail out of view is a tail nobody can take. */
  const mirror = useRef<HTMLDivElement>(null)

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

  // Before paint: a tail appearing over a scrolled field is drawn against the wrong line for the
  // frame an effect would take to fix it.
  useLayoutEffect(() => {
    if (mirror.current && field.current) mirror.current.scrollTop = field.current.scrollTop
  }, [ghost?.tail])

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
      // and dropping them left no trace at all. They land in the field instead. A question
      // STANDING is the exception: `say` reads what is spoken as its answer, as it does typing.
      if (assistant.busy && !typedInto(assistant.choosing)) {
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

          <AssistantConversationWorking />
        </ol>
      )}

      {asked && <AssistantConversationQuestion key={asked.id} request={asked.request} />}
      {choosing && <AssistantConversationChoice key={choosing.id} {...choosing} />}

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
            {listed.length > 0 && (
              <AssistantConversationSuggestions
                matches={rows}
                active={heldRow}
                label={t('assistant.suggestions')}
                hint={t('assistant.starterHint')}
                id={listId}
                onChoose={take}
              />
            )}

            {/* A textarea rather than a line: one SPEAKS here, and a dictated request runs long.
              The mirror sits behind it, and both are positioned for the writing to stay on top. */}
            <div className="relative">
              <GhostText
                ref={mirror}
                typed={draft}
                tail={ghost?.tail ?? ''}
                metrics={CONVERSATION_FIELD_TYPE}
              />
              <textarea
                ref={field}
                // The one field of the studio a client most wants to fill, and it had no name a
                // script could reach: the guard reads per FILE, and the model picker below it answers.
                data-sc={fieldHandle('assistant.draft')}
                rows={3}
                value={draft}
                // 🛑 No `role="combobox"`: it REPLACES the field's own role, and ARIA 1.2 drops
                // `aria-multiline` with it — what one writes here is a paragraph. These three ARE
                // allowed on a textbox, where `aria-expanded` is not and was read by nobody.
                aria-autocomplete={
                  ghost === undefined
                    ? listed.length > 0
                      ? 'list'
                      : undefined
                    : listed.length > 0
                      ? 'both'
                      : 'inline'
                }
                aria-haspopup={listed.length > 0 ? 'listbox' : undefined}
                // `aria-owns` beside it: ARIA asks that the held row be a descendant of the focused
                // element, and a textarea can hold none. Without it the walk is announced by nobody.
                aria-controls={listed.length > 0 ? listId : undefined}
                aria-owns={listed.length > 0 ? listId : undefined}
                aria-activedescendant={
                  listed.length === 0 ? undefined : suggestionId(listId, heldRow)
                }
                placeholder={t('assistant.placeholder')}
                // The only place the gesture is named to someone who does not read with an ear:
                // a grey tail reads as text already written until one is told what takes it.
                {...HINT_TOP(t('assistant.completeHint', { accept: keyLabel('Tab') }))}
                // While a plan is running: a second sentence would interleave two plans over one
                // generator form, and the question on screen belongs to the first of them. A
                // question STANDING is the exception, and the reason this is not just `busy`:
                // what is typed under it is that question's answer — see `say`.
                disabled={busy && !typing}
                onChange={event => {
                  setDraft(event.target.value)
                  setCaretAtEnd(atEnd(event.currentTarget))
                }}
                // Where the caret lands by click or by arrow. Read on change TOO, and not instead:
                // a field typed into fires one of the two on some engines and both on others.
                onSelect={event => setCaretAtEnd(atEnd(event.currentTarget))}
                onFocus={event => {
                  setWriting(true)
                  setCaretAtEnd(atEnd(event.currentTarget))
                }}
                onBlur={() => setWriting(false)}
                onScroll={event => {
                  if (mirror.current) mirror.current.scrollTop = event.currentTarget.scrollTop
                }}
                // Enter still sends, as it did when this was one line: a textarea's own default would
                // have made the keyboard path to sending disappear. Shift+Enter is the new line.
                onKeyDown={event => {
                  if (steer(event)) {
                    event.preventDefault()
                    return
                  }

                  // While an input method composes, Enter picks the candidate character — see
                  // `isComposing`. Sending here would cut the word being written.
                  if (event.key !== 'Enter' || event.shiftKey || isComposing(event)) return
                  event.preventDefault()
                  send()
                }}
                className={cn(
                  CONVERSATION_FIELD_TYPE,
                  'text-text relative w-full resize-none border-none bg-transparent',
                )}
              />
            </div>

            {/* The list appears, renumbers and goes under the fingers without a word otherwise —
                the same reason the title bar announces a reordered tab. */}
            <p role="status" aria-live="polite" className="sr-only">
              {[
                ghost === undefined
                  ? ''
                  : t('assistant.completing', {
                      sentence: ghost.sentence,
                      accept: keyLabel('Tab'),
                      arrow: keyLabel('ArrowRight'),
                    }),
                listed.length > 0 ? t('assistant.suggested', { count: listed.length }) : '',
              ]
                .filter(one => one !== '')
                .join(' ')}
            </p>

            {/* Wrapping: the picker and the pair sit side by side wherever there is room and
                stack where there is not — one line could only shrink, and the picker has a
                floor. The GAUGE gives ground first: it is the one part that reads the same
                narrower, and it kept pushing Send onto a row of its own. */}
            <div className="flex flex-wrap items-center gap-2">
              {/* Down here from the header, beside the sentence it will read: the moment one wants
                another brain is the middle of writing, not a trip to a preferences window. */}
              <AssistantConversationPicker />

              {/* Beside the field it measures, and it OUTLIVES the turn: what one wants to know
                  before typing is how much room is left — bound included, turn or no turn. */}
              <AssistantConversationGauge />

              {/* Beside the button it shares a job with: this pair is "how the sentence gets in". */}
              <span className="ml-auto flex shrink-0 items-center gap-2">
                <DictationButton variant="header" tooltip={TIP_TOP} />

                {/* Where Send was, and never beside it: the same corner the eye already goes to
                    for "act on this", and a chain one cannot stop is one nobody dares start. */}
                {busy && !typing ? (
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
