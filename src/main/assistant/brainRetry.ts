import type { AssistantAnswer } from '@shared/domain/assistant'
import { log } from '@main/log'
import { recentHistory } from './instruction'
import { parseReply } from './reply'

/** What one round trip came back with, and what it cost. Zero for a model on this machine. */
export type BrainAttempt = { answer: string; cost: number }

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

/**
 * One answer out of at most two attempts, whoever is doing the thinking.
 *
 * One retry only, and the second attempt is CAUGHT: the first pass was billed — measured at 0.75
 * units for the cheapest cloud — and an escaping rejection loses that figure.
 */
export async function retriedAnswer(
  ask: (complaint?: string) => Promise<BrainAttempt>,
): Promise<AssistantAnswer> {
  const first = await ask()
  const reply = parseReply(first.answer)
  if (reply) return { ...reply, cost: first.cost }

  log.warn('assistant', 'unreadable answer, asking once more')
  const second = await ask(complaintAbout(first.answer)).catch((error: unknown) => {
    log.warn('assistant', `the second attempt failed: ${String(error)}`)
    return { answer: '', cost: 0 }
  })

  const retried = parseReply(second.answer)
  const cost = first.cost + second.cost

  // Said plainly rather than thrown: the caller has a person waiting, and "I did not understand"
  // is a better answer than a stack trace — and the cost was still incurred.
  return retried ? { ...retried, cost } : { say: '', calls: [], cost }
}
