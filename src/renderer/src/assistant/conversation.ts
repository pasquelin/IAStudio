import { type ActionName, type ActionRefusal, refusalKey } from '@shared/domain/assistant'
import { englishText } from '@shared/i18n'

/** What one action of a turn did. `refusal` is `null` when it ran. */
export type AssistantStep = { action: ActionName; refusal: ActionRefusal | null }

/**
 * One exchange: what was said, what came back, and what it actually did.
 *
 * The steps are kept apart from the sentence rather than folded into it, because the two are
 * read by different eyes: the modal draws a line per step in the person's own language, and the
 * model gets the same steps in English through `assistantHistory`.
 */
export type AssistantTurn = {
  id: number
  said: string
  /** What the assistant answered. Empty when the actions speak for themselves. */
  answered: string
  steps: readonly AssistantStep[]
  /** Nothing readable came back — the model gave up after its retry, or the studio never answered. */
  lost: boolean
}

/**
 * The conversation as the model reads it: one block per turn, oldest first.
 *
 * One block per TURN and not one per line, because the API counts blocks and stops at ten
 * (`HISTORY_MAX`) — a block per line would spend the whole budget on two exchanges. The trimming
 * itself belongs to the main process, which is where the limit is enforced.
 *
 * English throughout, including the refusals: it is what the model reasons in, and a studio
 * running in French must not decide differently from one running in English.
 */
export function assistantHistory(turns: readonly AssistantTurn[]): string[] {
  return turns.map(blockOf)
}

function blockOf(turn: AssistantTurn): string {
  const lines = [`The person said: ${turn.said}`]
  if (turn.answered !== '') lines.push(`You answered: ${turn.answered}`)

  for (const step of turn.steps) {
    lines.push(
      step.refusal === null
        ? `You ran ${step.action}.`
        : `You tried ${step.action}, refused: ${englishText(refusalKey(step.refusal))}`,
    )
  }

  // Said rather than left out: a turn that shows as nothing at all would have the model repeat
  // the sentence it already failed on, instead of trying it another way.
  if (turn.lost) lines.push('You did not manage to answer that one.')

  return lines.join('\n')
}
