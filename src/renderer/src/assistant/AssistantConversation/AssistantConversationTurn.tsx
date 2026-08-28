import { useTranslation } from 'react-i18next'
import type { AssistantTurn } from '../conversation'
import { AssistantConversationStep } from './AssistantConversationStep'

/** One exchange: what was asked, what came back, and what each action actually did. */
export function AssistantConversationTurn({ turn }: { turn: AssistantTurn }) {
  const { t } = useTranslation()

  return (
    <li className="flex flex-col gap-2">
      {/* What one said, in a bubble, on the right — the side a chat has always put it. It is
          bounded because a dictated request runs long, and a bubble the width of the thread
          stops reading as one side of an exchange. */}
      <div className="flex justify-end">
        <p className="bg-surface text-text m-0 max-w-4/5 rounded-(--radius-sc-sm) px-2 py-1 text-xs">
          {turn.said}
        </p>
      </div>

      {/* What came back carries no bubble, and the asymmetry is the point: one side of this
          conversation is a request and the other is the studio answering for itself. Bubbles on
          both sides read as two people talking, which is not what this is. */}
      {turn.answered !== '' && <p className="text-text m-0 text-xs">{turn.answered}</p>}

      {turn.steps.map((step, index) => (
        // Keyed by position: the same action can legitimately run twice in one plan, and the
        // list only ever grows to the end.
        <AssistantConversationStep key={index} step={step} />
      ))}

      {turn.lost && <p className="text-warning text-mini m-0">{t('assistant.lost')}</p>}

      {/* A chain that did not end by itself SAYS so: cut at its ceiling or stopped by hand, it
          reads exactly like one that finished, and a half-done job would pass for a done one. */}
      {turn.ending && (
        <p className="text-muted text-mini m-0 italic">{t(`assistant.ending.${turn.ending}`)}</p>
      )}
    </li>
  )
}
