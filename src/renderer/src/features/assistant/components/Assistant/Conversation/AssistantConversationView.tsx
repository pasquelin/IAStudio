import {
  useLayoutEffect,
  useRef,
  type ComponentProps,
  type FocusEventHandler,
  type KeyboardEventHandler,
} from 'react'
import { mdiChatOutline } from '@mdi/js'
import { useTranslation } from 'react-i18next'
import { Button } from '@/components/Button'
import { EmptyState } from '@/components/EmptyState'
import { GhostText } from '@/components/GhostText'
import { QuietNote } from '@/components/QuietNote'
import { fieldHandle } from '@/components/scHandle'
import { PANEL_INSET, PANEL_SCROLL } from '@/components/styles'
import { cn } from '@/helpers/cn'
import { HINT_TOP, TIP_TOP } from '@/helpers/tooltip'
import { DictationButton } from '@/features/dictation/components/Dictation/DictationButton'
import { Heard } from '@/features/dictation/components/Heard'
import { AssistantConversationSuggestions, suggestionId } from './AssistantConversationSuggestions'
import { AssistantConversationPicker } from './AssistantConversationPicker'
import { AssistantConversationChoice } from './Choice/AssistantConversationChoice'
import { AssistantConversationGauge } from './AssistantConversationGauge'
import { AssistantConversationQuestion } from './AssistantConversationQuestion'
import { AssistantConversationTurn } from './AssistantConversationTurn'
import { AssistantConversationWorking } from './AssistantConversationWorking'
import { CONVERSATION_CARD, CONVERSATION_FIELD_TYPE } from './conversationStyles'

type Turn = ComponentProps<typeof AssistantConversationTurn>['turn']
type Asked = ComponentProps<typeof AssistantConversationQuestion>['request']
type Choice = ComponentProps<typeof AssistantConversationChoice>

type Props = {
  turns: readonly Turn[]
  asked: { id: number; request: Asked } | null
  choosing: Choice | null
  setThreadElement: (element: HTMLOListElement | null) => void
  onThreadScroll: () => void
  micOpen: boolean
  unserved: boolean
  openSettings: () => void
  listId: string
  listed: readonly string[]
  rows: readonly string[]
  heldRow: number
  take: (sentence: string) => void
  setFieldElement: (element: HTMLTextAreaElement | null) => void
  draft: string
  ghost?: { sentence: string; tail: string }
  keyLabel: (key: string) => string
  busy: boolean
  typing: boolean
  stopping: boolean
  stop: () => void
  setDraft: (draft: string) => void
  setCaretAtEnd: (atEnd: boolean) => void
  setWriting: (writing: boolean) => void
  onFieldKeyDown: KeyboardEventHandler<HTMLTextAreaElement>
  send: () => void
  onFocus: () => void
  onBlur: FocusEventHandler<HTMLDivElement>
}

export function AssistantConversationView(props: Props) {
  const { t } = useTranslation()
  const mirrorRef = useRef<HTMLDivElement>(null)
  const fieldRef = useRef<HTMLTextAreaElement>(null)
  const setThreadElement = (element: HTMLOListElement | null) => props.setThreadElement(element)
  const setFieldElement = (element: HTMLTextAreaElement | null) => {
    fieldRef.current = element
    props.setFieldElement(element)
  }
  useLayoutEffect(() => {
    if (mirrorRef.current && fieldRef.current)
      mirrorRef.current.scrollTop = fieldRef.current.scrollTop
  }, [props.ghost?.tail])
  return (
    <div
      onFocus={props.onFocus}
      onBlur={props.onBlur}
      className={cn(PANEL_INSET, 'flex min-h-0 w-full flex-1 flex-col gap-2')}
    >
      {props.turns.length === 0 && !props.asked && !props.choosing ? (
        <div className="flex flex-1 flex-col justify-center">
          {!props.unserved && <QuietNote standalone>{t('assistant.empty')}</QuietNote>}
        </div>
      ) : (
        <ol
          ref={setThreadElement}
          onScroll={props.onThreadScroll}
          className={cn(PANEL_SCROLL, 'm-0 list-none gap-2 pr-0 pl-0')}
        >
          {props.turns.map(turn => (
            <AssistantConversationTurn key={turn.id} turn={turn} />
          ))}
          <AssistantConversationWorking />
          {props.asked && (
            <li key={props.asked.id}>
              <AssistantConversationQuestion request={props.asked.request} />
            </li>
          )}
          {props.choosing && (
            <li key={props.choosing.id}>
              <AssistantConversationChoice {...props.choosing} />
            </li>
          )}
        </ol>
      )}
      {props.micOpen && (
        <Heard label={t('assistant.listening')} className="shrink-0 px-2 text-xs" />
      )}
      {props.unserved ? (
        <EmptyState
          icon={mdiChatOutline}
          message={t('assistant.unserved')}
          action={{
            label: t('generation.chooseModel'),
            hint: t('assistant.chooseModelHint'),
            onClick: props.openSettings,
          }}
        />
      ) : (
        <form
          className={CONVERSATION_CARD}
          onSubmit={event => {
            event.preventDefault()
            props.send()
          }}
        >
          {props.listed.length > 0 && (
            <AssistantConversationSuggestions
              matches={props.rows}
              active={props.heldRow}
              label={t('assistant.suggestions')}
              hint={t('assistant.starterHint')}
              id={props.listId}
              onChoose={props.take}
            />
          )}
          <div className="relative">
            <GhostText
              ref={mirrorRef}
              typed={props.draft}
              tail={props.ghost?.tail ?? ''}
              metrics={CONVERSATION_FIELD_TYPE}
            />
            <textarea
              ref={setFieldElement}
              data-sc={fieldHandle('assistant.draft')}
              rows={3}
              value={props.draft}
              aria-autocomplete={
                props.ghost === undefined
                  ? props.listed.length > 0
                    ? 'list'
                    : undefined
                  : props.listed.length > 0
                    ? 'both'
                    : 'inline'
              }
              aria-haspopup={props.listed.length > 0 ? 'listbox' : undefined}
              aria-controls={props.listed.length > 0 ? props.listId : undefined}
              aria-owns={props.listed.length > 0 ? props.listId : undefined}
              aria-activedescendant={
                props.listed.length === 0 ? undefined : suggestionId(props.listId, props.heldRow)
              }
              placeholder={t('assistant.placeholder')}
              {...HINT_TOP(t('assistant.completeHint', { accept: props.keyLabel('Tab') }))}
              disabled={props.busy && !props.typing}
              onChange={event => {
                props.setDraft(event.target.value)
                props.setCaretAtEnd(
                  event.currentTarget.selectionStart === event.currentTarget.value.length,
                )
              }}
              onSelect={event =>
                props.setCaretAtEnd(
                  event.currentTarget.selectionStart === event.currentTarget.value.length,
                )
              }
              onFocus={event => {
                props.setWriting(true)
                props.setCaretAtEnd(
                  event.currentTarget.selectionStart === event.currentTarget.value.length,
                )
              }}
              onBlur={() => props.setWriting(false)}
              onScroll={event => {
                if (mirrorRef.current) mirrorRef.current.scrollTop = event.currentTarget.scrollTop
              }}
              onKeyDown={props.onFieldKeyDown}
              className={cn(
                CONVERSATION_FIELD_TYPE,
                'text-text relative w-full resize-none border-none bg-transparent',
              )}
            />
          </div>
          <p role="status" aria-live="polite" className="sr-only">
            {[
              props.ghost === undefined
                ? ''
                : t('assistant.completing', {
                    sentence: props.ghost.sentence,
                    accept: props.keyLabel('Tab'),
                    arrow: props.keyLabel('ArrowRight'),
                  }),
              props.listed.length > 0
                ? t('assistant.suggested', { count: props.listed.length })
                : '',
            ]
              .filter(Boolean)
              .join(' ')}
          </p>
          <div className="flex flex-wrap items-center gap-2">
            <AssistantConversationPicker />
            <AssistantConversationGauge />
            <span className="ml-auto flex shrink-0 items-center gap-2">
              <DictationButton variant="header" tooltip={TIP_TOP} />
              {props.busy && !props.typing ? (
                <Button
                  type="button"
                  onClick={props.stop}
                  disabled={props.stopping}
                  {...HINT_TOP(t('assistant.stopHint'))}
                >
                  {t('assistant.stop')}
                </Button>
              ) : (
                <Button
                  type="submit"
                  variant="primary"
                  disabled={props.draft.trim() === ''}
                  {...HINT_TOP(t('assistant.sendHint'))}
                >
                  {t('assistant.send')}
                </Button>
              )}
            </span>
          </div>
        </form>
      )}
    </div>
  )
}
