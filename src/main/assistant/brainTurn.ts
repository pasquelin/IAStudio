import type { AssistantAnswer } from '@shared/domain/assistant'
import { log } from '@main/log'
import type { Briefing } from './instruction'
import { recentHistory } from './instruction'
import { parseReply, type Reply } from './reply'

/**
 * A door that refused the request for its SIZE, which is the only refusal a shorter briefing can
 * answer. Raised by whoever can tell — for a chat cloud, a 400, 413 or 422.
 */
export class OversizedRequest extends Error {}

/** What one round trip came back with, and what it cost. Zero for a model on this machine. */
export type BrainAttempt = { answer: string; cost: number }

/** One round trip against one briefing, complaint included — what every brain hands over. */
export type BrainRound = (briefing: Briefing, complaint?: string) => Promise<BrainAttempt>

/** Quoting the answer back is what works; bounded so an essay does not eat the history budget. */
function complaintAbout(answer: string): string {
  return [
    'Your previous answer could not be read. It must be one JSON object with the keys "say" and',
    '"calls", and nothing else around it. This is what you sent:',
    answer.slice(0, 500),
  ].join('\n')
}

/**
 * The turns a brain sends, complaint included. Trimmed once, at the END: the history arrives
 * already bounded, so trimming before adding the complaint could only drop the complaint's room.
 */
export function turnsWith(history: readonly string[], complaint?: string): string[] {
  return recentHistory(complaint ? [...history, complaint] : history)
}

type Read = { reply: Reply | null; cost: number }

/**
 * 🛑 What ONE sentence may cost, in round trips, whatever path it takes.
 *
 * Three bounded layers compose to eight — retry ×2, narrow ×2, expand ×2 — and each was sure of
 * itself alone. On Scenario's door every one of them is a billed job, so the ceiling is held here
 * rather than deduced from the three.
 */
const TURN_ATTEMPTS = 4

/** The attempts one turn has left. Passed rather than closed over: a turn is not a session. */
type Budget = { left: number }

/**
 * One reply out of at most two attempts against ONE briefing.
 *
 * One retry only, and the second attempt is CAUGHT: the first pass was billed — measured at 0.75
 * units for the cheapest cloud — and an escaping rejection loses that figure.
 */
async function readOnce(briefing: Briefing, round: BrainRound, budget: Budget): Promise<Read> {
  budget.left -= 1
  const first = await round(briefing)
  const reply = parseReply(first.answer, briefing.allowed)
  if (reply || budget.left <= 0) return { reply, cost: first.cost }

  log.warn('assistant', 'unreadable answer, asking once more')
  budget.left -= 1
  const second = await round(briefing, complaintAbout(first.answer)).catch((error: unknown) => {
    log.warn('assistant', `the second attempt failed: ${String(error)}`)
    return { answer: '', cost: 0 }
  })

  return { reply: parseReply(second.answer, briefing.allowed), cost: first.cost + second.cost }
}

/**
 * One reading, and the short share when the door refused the whole one.
 *
 * The room a chat cloud holds is an assumption — the model is typed by hand — so this is what
 * degrades when the assumption is wrong: a refusal costs one round trip, not the turn.
 */
async function readOrNarrow(
  briefing: Briefing,
  round: BrainRound,
  budget: Budget,
): Promise<[Briefing, Read]> {
  try {
    return [briefing, await readOnce(briefing, round, budget)]
  } catch (error) {
    // Only a refusal of SIZE narrows. A missing key, a quota, a dropped network and a cancelled
    // turn all reach here too, and none of them is answered by a shorter catalogue.
    if (briefing.narrow === null || budget.left <= 0 || !(error instanceof OversizedRequest)) {
      throw error
    }

    log.warn('assistant', `too much for this door, asking with the short list: ${String(error)}`)
    const narrow = briefing.narrow()
    return [narrow, await readOnce(narrow, round, budget)]
  }
}

/**
 * The one thing a model may ask for rather than do: the rest of the catalogue — and only when it
 * is the WHOLE answer. A plan that also acts is run ENTIRE, find call included, because
 * `parseReply` never filters a reply down to the calls it likes.
 */
function discoveryIn(reply: Reply | null): string | null {
  const only = reply?.calls.length === 1 ? reply.calls[0] : undefined
  if (only?.action !== 'actions.find') return null

  const query = only.input['query']
  return typeof query === 'string' && query.trim() !== '' ? query : null
}

// Said plainly rather than thrown: the caller has a person waiting, and "I did not understand"
// is a better answer than a stack trace — and the cost was still incurred.
const answerOf = (read: Read, spentBefore = 0): AssistantAnswer => {
  const cost = read.cost + spentBefore
  return read.reply ? { ...read.reply, cost } : { say: '', calls: [], cost }
}

/**
 * One answer for one sentence, whoever is doing the thinking: at most two briefings — the one the
 * room allowed, and the same one with what a query found — inside `TURN_ATTEMPTS` round trips.
 */
export async function answeredTurn(
  briefing: Briefing,
  round: BrainRound,
): Promise<AssistantAnswer> {
  const budget: Budget = { left: TURN_ATTEMPTS }
  const [shown, first] = await readOrNarrow(briefing, round, budget)
  const query = discoveryIn(first.reply)
  if (query === null || shown.expand === null || budget.left <= 0) return answerOf(first)

  log.info('assistant', `the model asked what else there is: "${query}"`)
  // Through the same fallback: an expansion is longer than the briefing that just went through,
  // so it is the one read most likely to be refused for its size.
  const [, second] = await readOrNarrow(shown.expand(query), round, budget)

  return answerOf(second, first.cost)
}
