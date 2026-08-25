import {
  HISTORY_BLOCK_MAX,
  type ActionName,
  type ActionRefusal,
  refusalKey,
} from '@shared/domain/assistant'
import { englishText } from '@shared/i18n'

/**
 * What one action of a turn did. `refusal` is `null` when it ran.
 *
 * `data` is what it ANSWERED, and it is what makes a chain possible: the model asks for a path
 * it does not know, and the next step of its own plan is written from this. Absent for an action
 * that answers nothing, which most of the acting ones do.
 */
export type AssistantStep = {
  action: ActionName
  refusal: ActionRefusal | null
  data?: unknown
}

/**
 * 🛑 What one result may spend of the model's window, in characters.
 *
 * A listing of a full project is thousands of entries; handed back whole it would push the
 * briefing out of every door — Scenario's leaves 8 000 characters for ALL of it. Cut to a size,
 * and what was cut is SAID: a model reading a silently truncated list plans against a project
 * half of which it cannot see.
 */
const RESULT_MAX = 600

/** The first entries of a list, or a value, as the model reads it — never a broken JSON tail. */
export function resultLine(data: unknown): string {
  if (Array.isArray(data)) return listWithin(data)

  const written = JSON.stringify(data) ?? ''
  // A lone value is cut by characters and SAID to be cut: it has no items to drop by, and a
  // model told nothing would read the tail it never got as the whole answer.
  return written.length <= RESULT_MAX ? written : `${written.slice(0, RESULT_MAX)}… (cut short)`
}

/**
 * Entries dropped by WHOLE items and counted, never by characters: half an entry is a path the
 * model would call with, and a call on half a path opens nothing.
 */
function listWithin(items: readonly unknown[]): string {
  // 🛑 An empty list is where a chain stalls, and `0 results: []` reads as an answer rather than
  // as nothing at all: the model reported it to the person and stopped. Said in words rather
  // than in brackets, at the moment it decides.
  //
  // No instruction with it, and that is deliberate: `jobs.list` answers empty for a job that has
  // not registered yet, and "do not repeat it" would tell a model to stop watching its own
  // generation — the very thing it was asked to do.
  if (items.length === 0) return '0 results — nothing matched.'

  const kept: string[] = []
  let left = RESULT_MAX

  for (const item of items) {
    const written = JSON.stringify(item) ?? ''
    if (written.length + 2 > left) break
    left -= written.length + 2
    kept.push(written)
  }

  const rest = items.length - kept.length
  const more = rest > 0 ? ` (and ${rest} more, not shown)` : ''
  return `${items.length} results: [${kept.join(', ')}]${more}`
}

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
  /**
   * How a chain ended when it did not end by itself. Absent means the model answered with no
   * calls left — the only ending that means "done".
   *
   * Written rather than inferred: a chain cut at its ceiling looks exactly like one that
   * finished, and a person told nothing would take a half-done job for a finished one.
   */
  ending?: 'halted' | 'stopped'
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
  return turns.map(one => blockWithin(blockOf(one)))
}

/**
 * 🛑 One block cut to what the boundary takes, from the OLDEST steps in.
 *
 * A chain writes into one block, and a long one is refused whole — `parseThought` throws, the
 * window reads nothing back, and a chain that was working dies as "I did not manage to answer
 * that one". What a round needs is what just happened, so the head and the tail are what stay.
 */
function blockWithin(block: string): string {
  if (block.length <= HISTORY_BLOCK_MAX) return block

  const [head = '', ...rest] = block.split('\n')
  // The sentence is cut too: a 10 000-character paste is a whole block on its own, and a head
  // emitted whatever its length would overrun the bound with no step shown at all.
  const said =
    head.length > HISTORY_BLOCK_MAX / 2 ? `${head.slice(0, HISTORY_BLOCK_MAX / 2)}…` : head
  const kept: string[] = []
  let left = HISTORY_BLOCK_MAX - said.length - 40

  for (const line of [...rest].reverse()) {
    if (line.length + 1 > left) break
    left -= line.length + 1
    kept.unshift(line)
  }

  // Said, never silent: a model reading a block it cannot tell was cut plans against steps it
  // believes never ran, and runs them again.
  return [said, `(${rest.length - kept.length} earlier steps not shown)`, ...kept].join('\n')
}

function blockOf(turn: AssistantTurn): string {
  const lines = [`The person said: ${turn.said}`]
  if (turn.answered !== '') lines.push(`You answered: ${turn.answered}`)

  for (const step of turn.steps) {
    if (step.refusal !== null) {
      // 🛑 The refusal's own sentence and nothing more. A repair named here would name an
      // ACTION, and this history reaches every door — including the ones shown fourteen actions,
      // where `parseReply` refuses a whole reply for naming a fifteenth. `WIDE_RULES` is where
      // advice that names an action belongs, because only there is it filtered by door.
      lines.push(`You tried ${step.action}, refused: ${englishText(refusalKey(step.refusal))}`)
      continue
    }

    // The answer, not just the fact: without it a model that has just searched cannot open what
    // it found, and asks for the same search again. Written inline rather than bound to a name —
    // `no-hardcoded-text.test.ts` reads a named sentence as one bound for a screen.
    lines.push(
      step.data === undefined
        ? `You ran ${step.action}.`
        : `You ran ${step.action}. It answered: ${resultLine(step.data)}`,
    )
  }

  // Said rather than left out: a turn that shows as nothing at all would have the model repeat
  // the sentence it already failed on, instead of trying it another way.
  if (turn.lost) lines.push('You did not manage to answer that one.')
  if (turn.ending === 'halted') lines.push('You were stopped there: too many rounds on that one.')
  if (turn.ending === 'stopped') lines.push('The person stopped you there.')

  return lines.join('\n')
}
