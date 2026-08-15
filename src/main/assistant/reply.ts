import {
  type ActionName,
  assistantAction,
  type AssistantCall,
  type AssistantAnswer,
} from '@shared/domain/assistant'
import { isRecord } from '@shared/guards'

/** What `parseReply` answers: the reply without the cost, which only the caller knows. */
type Reply = Omit<AssistantAnswer, 'cost'>

/**
 * Reads what the model answered, and refuses everything it cannot vouch for.
 *
 * The model has no tool use: it is asked for JSON and answers text, so this is the seam where a
 * plausible sentence becomes — or fails to become — something the studio will act on. It is
 * written to be strict on purpose. A call it lets through is a call that runs.
 */

/**
 * Pulls the object out of whatever the model wrapped it in.
 *
 * A well-behaved answer is bare JSON and parses on the first line of this function. The rest is
 * for the cheapest model on the list, which says "Here you go:" and puts the object in a code
 * fence about as often as not — measured behaviour, not pessimism. Recovering it costs four
 * lines; refusing it costs a round trip and a creative unit.
 */
export function jsonIn(text: string): unknown {
  const trimmed = text.trim()

  try {
    return JSON.parse(trimmed)
  } catch {
    // The outermost braces, so a fence, a preamble or a trailing word all fall away together.
    const start = trimmed.indexOf('{')
    const end = trimmed.lastIndexOf('}')
    if (start === -1 || end <= start) return null

    try {
      return JSON.parse(trimmed.slice(start, end + 1))
    } catch {
      return null
    }
  }
}

function callIn(value: unknown): AssistantCall | null {
  if (!isRecord(value)) return null

  const action = assistantAction(typeof value.action === 'string' ? value.action : '')
  if (!action) return null

  // An action with no fields may legitimately arrive without an input at all.
  const input = value.input
  if (input !== undefined && !isRecord(input)) return null

  return { action: action.name satisfies ActionName, input: isRecord(input) ? input : {} }
}

/**
 * The reply, or `null` when nothing usable came back.
 *
 * `null` rather than a thrown error or a half-reply: the caller retries once, quoting the fault,
 * and a partially-read answer would have it act on the half that parsed.
 *
 * A reply naming one action the registry does not declare is refused whole rather than filtered
 * down to the ones it does. Dropping the unknown call silently would run the remainder of a plan
 * whose author meant it to run entire — the studio would do half of something nobody asked for.
 */
export function parseReply(text: string): Reply | null {
  const parsed = jsonIn(text)
  if (!isRecord(parsed)) return null

  const say = typeof parsed.say === 'string' ? parsed.say : ''
  const rawCalls = parsed.calls

  // Absent is allowed and means none; present and not a list is a shape nobody meant.
  if (rawCalls !== undefined && !Array.isArray(rawCalls)) return null

  const calls: AssistantCall[] = []
  for (const raw of Array.isArray(rawCalls) ? rawCalls : []) {
    const call = callIn(raw)
    if (!call) return null
    calls.push(call)
  }

  /**
   * Neither a word nor a deed, which is not an answer a person can be shown — and the check that
   * has to sit at the end of EVERY path rather than at the end of the happy one. An early return
   * for the no-calls case let `[1,2,3]` and `{}` through as an empty reply, which the caller
   * would have shown as the assistant having nothing to say.
   */
  if (say.trim() === '' && calls.length === 0) return null

  return { say, calls }
}
