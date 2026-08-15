import { mdiClose } from '@mdi/js'
import { useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import {
  ASSISTANT_MODELS,
  assistantAction,
  type AssistantModel,
  refusalKey,
} from '@shared/domain/assistant'
import { Button } from '@/design/Button'
import { QuietNote } from '@/design/QuietNote'
import { Spinner } from '@/design/Spinner'
import { ToolButton } from '@/design/ToolButton'
import { CONTROL } from '@/design/styles'
import { cn } from '@/helpers/cn'
import { HINT_TOP, TIP_LEFT, TIP_TOP } from '@/helpers/tooltip'
import { useDismiss } from '@/hooks/useDismiss'
import { useAssistant } from '@/stores/assistant'
import { useDictation } from '@/stores/dictation'
import { useSettings } from '@/stores/settings'
import { formatUnits } from '@/usage/format'
import { DictationButton } from '@/dictation/DictationButton'
import { Heard } from '@/dictation/Heard'
import { registerDictationTarget } from '@/dictation/destination'
import type { ConfirmRequest } from './confirm'
import { registerConfirmer } from './confirm'
import type { AssistantStep, AssistantTurn } from './conversation'

/**
 * The assistant, as a modal over the whole window.
 *
 * Mounted once by the shell rather than by a panel, for two reasons that both come down to the
 * same thing: it is the studio one talks to, not a dock — and it is where a question gets asked
 * before anything is spent, including a question raised from outside this window. A panel that
 * happened to be closed would mean no one could be asked.
 *
 * Deliberately plain. What it has to carry beyond a field and a thread is what holds a decision
 * rather than a look: the running total, the yes-or-no, and the model picker — which lives here
 * and not in the settings because the moment one wants a better model is the middle of a
 * sentence.
 */
export function AssistantOverlay() {
  const { t, i18n } = useTranslation()
  const open = useAssistant(state => state.open)
  const turns = useAssistant(state => state.turns)
  const busy = useAssistant(state => state.busy)
  const asked = useAssistant(state => state.asked)
  const spent = useAssistant(state => state.spent)
  const hide = useAssistant(state => state.hide)
  const micOpen = useDictation(store => store.state === 'listening')
  const model = useSettings(state => state.settings.assistant.model)

  const surface = useRef<HTMLDivElement>(null)
  const thread = useRef<HTMLOListElement>(null)
  /**
   * Whether the thread was at its end when the last turn arrived.
   *
   * Kept so that reading back through the conversation is not undone by the answer that lands
   * while one is reading: the thread follows the newest line only for someone already there.
   */
  const following = useRef(true)
  const field = useRef<HTMLTextAreaElement>(null)
  const [draft, setDraft] = useState('')

  // For as long as the shell is up, and only from here: a confirmation shown where nobody is
  // looking is not a confirmation.
  useEffect(() => registerConfirmer(useAssistant.getState().ask), [])

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
      // While a plan is running the assistant takes no new sentence — but the words were spoken,
      // and dropping them left no trace at all: not sent, not inserted at the caret (the claim
      // above short-circuits that), nothing on screen. They land in the field instead, where
      // they wait exactly as typed ones do.
      if (useAssistant.getState().busy) {
        setDraft(current => (current === '' ? text : `${current} ${text}`))
        return
      }

      void useAssistant.getState().say(text)
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

  useEffect(() => {
    if (open) field.current?.focus()
  }, [open])

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

  useEffect(() => {
    const list = thread.current
    if (list && following.current) list.scrollTop = list.scrollHeight
  }, [turns])

  if (!open) return null

  const send = (): void => {
    // Sending is asking to see the answer. Without this, one trip up the thread to reread an
    // earlier exchange turned the following off for the rest of the session — every later reply
    // then landed out of sight, with nothing on screen saying why.
    following.current = true
    void useAssistant.getState().say(draft)
    setDraft('')
  }

  return (
    // Black and nearly opaque, and that is the whole staging: this is not a box laid on the studio
    // but a conversation held OVER it, with the application sunk to a backdrop behind the words.
    // The blur is what keeps it a backdrop rather than a wall — one can still tell the studio is
    // under there. It blurs the layer BEHIND this element, so the window itself stays opaque:
    // the rule against vibrancy is about judging colours in the studio, and nothing is being
    // judged while this is up.
    <div className="bg-scrim-deep fixed inset-0 z-50 flex justify-center p-8 backdrop-blur-sm">
      <div
        ref={surface}
        // Still a dialog for anyone not looking at it: Escape closes, focus goes to the field, and
        // the studio behind is out of reach. What changed is the chrome, not the behaviour.
        role="dialog"
        aria-modal="true"
        aria-label={t('assistant.title')}
        // No border, no panel fill, no shadow: nothing frames it, because there is no box. The
        // room of a conversation, since the thread is what one reads here — a container the height
        // of its content put five exchanges behind a scrollbar with two thirds of the window empty.
        className="flex h-full w-full max-w-3xl flex-col gap-3"
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

        {/* Centred while there is nothing to read, so the first sentence is written where the eye
            already is rather than at the foot of an empty page. */}
        <div
          className={cn(
            'flex min-h-0 flex-1 flex-col gap-3',
            turns.length === 0 && 'justify-center',
          )}
        >
          {turns.length === 0 ? (
            <QuietNote standalone>{t('assistant.empty')}</QuietNote>
          ) : (
            <ol
              ref={thread}
              onScroll={rememberScroll}
              // No bar: a thread reads as a page of words, and one down its side turns it back
              // into a scrolling box. Elsewhere in the studio the bar is information.
              className="m-0 flex min-h-0 flex-1 scrollbar-none list-none flex-col gap-3 overflow-y-auto p-0"
            >
              {turns.map(turn => (
                <Turn key={turn.id} turn={turn} />
              ))}
            </ol>
          )}

          {busy && !asked && (
            <Spinner label={t('assistant.thinking')} size={16} className="text-muted shrink-0" />
          )}

          {asked && <Question request={asked.request} />}

          {/* The running hypothesis, above the field it will land in. The label is what makes it
            this window's: it says where the words are going, which "Listening…" does not — the
            same microphone dictates into a prompt. */}
          {micOpen && <Heard label={t('assistant.listening')} className="shrink-0 px-2 text-xs" />}

          {/* One block, and everything that composes a sentence lives INSIDE it: the field, the
            model it will be read by, the microphone and the send. They were a row of separate
            controls beside a one-line input, which read as a form rather than as the place one
            talks. */}
          <form
            className={cn(
              'border-border bg-surface flex shrink-0 flex-col gap-2',
              'rounded-(--radius-sc-lg) border p-2',
            )}
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
                if (event.key !== 'Enter' || event.shiftKey) return
                event.preventDefault()
                send()
              }}
              className="text-text w-full resize-none border-none bg-transparent px-1 text-sm"
            />

            <div className="flex items-center gap-2">
              {/* Down here from the header, beside the sentence it will read: the moment one wants
                a better model is the middle of writing, not a trip to a title bar. */}
              <select
                {...TIP_TOP(t('assistant.model'), false, t('assistant.modelHint'))}
                value={model}
                onChange={event => useAssistant.getState().setModel(asModel(event.target.value))}
                className={cn(CONTROL, 'max-w-44 px-1')}
              >
                {/* Named from the bundle, never from the union: a raw `gemini-3.5-flash` in an
                  otherwise French list is the defect this repository pays for most. */}
                {ASSISTANT_MODELS.map(name => (
                  <option key={name} value={name}>
                    {t(`assistant.models.${name}`)}
                  </option>
                ))}
              </select>

              {/* Beside the button it shares a job with: this pair is "how the sentence gets in". */}
              <span className="ml-auto flex items-center gap-2">
                <DictationButton variant="header" tooltip={TIP_TOP} />

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
        </div>
      </div>
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

/**
 * The one cast in the file, and why it is safe: the `<option>` list is built from
 * `ASSISTANT_MODELS`, so the only values this element can produce are the ones the union holds.
 */
function asModel(value: string): AssistantModel {
  return value as AssistantModel
}

/** One exchange: what was asked, what came back, and what each action actually did. */
function Turn({ turn }: { turn: AssistantTurn }) {
  const { t } = useTranslation()

  return (
    <li className="flex flex-col gap-3">
      {/* What one said, in a bubble, on the right — the side a chat has always put it. It is
          bounded because a dictated request runs long, and a bubble the width of the thread
          stops reading as one side of an exchange. */}
      <div className="flex justify-end">
        <p className="bg-surface text-text m-0 max-w-4/5 rounded-(--radius-sc-lg) px-3 py-2 text-sm">
          {turn.said}
        </p>
      </div>

      {/* What came back carries no bubble, and the asymmetry is the point: one side of this
          conversation is a request and the other is the studio answering for itself. Bubbles on
          both sides read as two people talking, which is not what this is. */}
      {turn.answered !== '' && <p className="text-text m-0 text-sm">{turn.answered}</p>}

      {turn.steps.map((step, index) => (
        // Keyed by position: the same action can legitimately run twice in one plan, and the
        // list only ever grows to the end.
        <Step key={index} step={step} />
      ))}

      {turn.lost && <p className="text-warning text-mini m-0">{t('assistant.lost')}</p>}
    </li>
  )
}

function Step({ step }: { step: AssistantStep }) {
  const { t } = useTranslation()
  const action = assistantAction(step.action)
  // An action the registry no longer declares cannot reach here — the executor checks first —
  // but a thread rendered from a turn kept across a reload could, and a blank line says nothing.
  const title = action ? t(action.titleKey) : step.action

  if (step.refusal === null) return <p className="text-muted text-mini m-0 px-2">{title}</p>

  return (
    <p className="text-warning text-mini m-0 px-2">
      {t('assistant.refused', { action: title, reason: t(refusalKey(step.refusal)) })}
    </p>
  )
}

/**
 * The yes-or-no, with what it engages stated first.
 *
 * A figure is quoted only when there is one: an upload has no price, and `null` means the API
 * declined to give one — said as such rather than filled in with a guess.
 */
function Question({ request }: { request: ConfirmRequest }) {
  const { t, i18n } = useTranslation()
  const action = assistantAction(request.action)
  const answer = useAssistant(state => state.answer)

  const reason = (): string => {
    if (request.commitment === 'asset') return t('assistant.confirm.asset')
    if (typeof request.estimate !== 'number') return t('assistant.confirm.unknownCost')

    return t('assistant.confirm.credits', {
      cost: t('generation.estimatedCost', {
        units: formatUnits(request.estimate, i18n.language),
      }),
    })
  }

  return (
    <div
      className={cn(
        'border-border bg-surface flex shrink-0 flex-col gap-2',
        'rounded-(--radius-sc-md) border p-2',
      )}
    >
      <p className="text-text m-0 text-xs font-medium">
        {action ? t(action.titleKey) : request.action}
      </p>
      <p className="text-muted text-mini m-0">{reason()}</p>

      <div className="flex items-center gap-2">
        <Button
          variant="primary"
          onClick={() => answer(true)}
          {...HINT_TOP(t('assistant.confirm.yesHint'))}
        >
          {t('assistant.confirm.yes')}
        </Button>
        <Button onClick={() => answer(false)} {...HINT_TOP(t('assistant.confirm.noHint'))}>
          {t('assistant.confirm.no')}
        </Button>
      </div>
    </div>
  )
}
