import { useTranslation } from 'react-i18next'
import type { AssistantTurn } from '../conversation'
import { AssistantOverlayStep } from './AssistantOverlayStep'

/** One exchange: what was asked, what came back, and what each action actually did. */
export function AssistantOverlayTurn({ turn }: { turn: AssistantTurn }) {
  const { t } = useTranslation()

  return (
    <li className="flex flex-col gap-3">
      {/* What one said, in a bubble, on the right — the side a chat has always put it. It is
          bounded because a dictated request runs long, and a bubble the width of the thread
          stops reading as one side of an exchange. */}
      <div className="flex justify-end">
        <p className="bg-surface text-text rounded-sc-lg m-0 max-w-4/5 px-3 py-2 text-base">
          {turn.said}
        </p>
      </div>

      {/* What came back carries no bubble, and the asymmetry is the point: one side of this
          conversation is a request and the other is the studio answering for itself. Bubbles on
          both sides read as two people talking, which is not what this is. */}
      {turn.answered !== '' && <p className="text-text m-0 text-base">{turn.answered}</p>}

      {turn.steps.map((step, index) => (
        // Keyed by position: the same action can legitimately run twice in one plan, and the
        // list only ever grows to the end.
        <AssistantOverlayStep key={index} step={step} />
      ))}

      {turn.lost && <p className="text-warning text-mini m-0">{t('assistant.lost')}</p>}
    </li>
  )
}
