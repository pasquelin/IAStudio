/**
 * Reads what the model answered, and refuses everything it cannot vouch for.
 *
 * The model has no tool use: it is asked for JSON and answers text, so this is the seam where a
 * plausible sentence becomes — or fails to become — something the studio will act on. It is
 * written to be strict on purpose. A call it lets through is a call that runs.
 */
import {
  type ActionName,
  type AskedQuestion,
  assistantAction,
  MOST_QUESTIONS,
  type AssistantAsk,
  type AssistantCall,
  type AssistantAnswer,
} from '@shared/domain/assistant'
import { isRecord, readText } from '@shared/guards'

/** What `parseReply` answers: the reply without the cost, which only the caller knows. */
export type Reply = Omit<AssistantAnswer, 'cost'>

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

/**
 * 🛑 An empty PLACEHOLDER is not a question: `""`, `{}`, `[]`, `false` and `{"questions":[]}` all
 * mean « none ». Refusing the whole reply over one costs two billed rounds on a shape the retry
 * cannot even name — it only ever complains about the three keys, which such an answer has.
 */
function asksNothing(value: unknown): boolean {
  if (Array.isArray(value)) return value.length === 0
  if (isRecord(value)) {
    return (
      Object.keys(value).length === 0 ||
      (Array.isArray(value.questions) && value.questions.length === 0)
    )
  }

  return typeof value !== 'string' || value.trim() === ''
}

/** The question or questions, or nothing where the key carries none to read. */
function askIn(value: unknown): AssistantAsk | null {
  const listed = Array.isArray(value)
    ? value
    : isRecord(value) && Array.isArray(value.questions)
      ? value.questions
      : null

  if (listed) {
    if (listed.length === 0 || listed.length > MOST_QUESTIONS) return null

    const questions: AskedQuestion[] = []
    for (const one of listed) {
      const question = questionIn(one)
      if (!question) return null
      questions.push(question)
    }
    return { questions }
  }

  const one = questionIn(value)
  return one ? { questions: [one] } : null
}

/**
 * 🛑 A bare STRING is recovered, not dropped: it was thrown in silence and the calls beside it
 * sent. Wrapped rather than read apart, so both spellings yield the same question.
 *
 * The choices are FILTERED rather than refused: an empty list is legitimate — the answer is typed.
 */
function questionIn(value: unknown): AskedQuestion | null {
  const held = typeof value === 'string' ? { question: value } : value
  if (!isRecord(held)) return null

  const question = readText(held, 'question')
  if (question === null) return null

  const raw = Array.isArray(held.choices) ? held.choices : []
  const choices = raw.filter((one): one is string => typeof one === 'string' && one.trim() !== '')

  return { question, choices, ...(held.note === true ? { note: true } : {}) }
}

function callIn(value: unknown, shown: ReadonlySet<ActionName>): AssistantCall | null {
  if (!isRecord(value)) return null

  /**
   * 🛑 Held to what the briefing NAMED, which is the whole registry now that the catalogue is
   * names alone — a hallucinated action is still refused. Whether the model had that action's
   * FIELDS is a different question, and one `answeredTurn` answers by opening them.
   */
  const action = assistantAction(typeof value.action === 'string' ? value.action : '')
  if (!action || !shown.has(action.name)) return null

  // An action with no fields may legitimately arrive without an input at all.
  const input = value.input
  if (input !== undefined && !isRecord(input)) return null

  return { action: action.name satisfies ActionName, input: isRecord(input) ? input : {} }
}

function callsIn(value: unknown, shown: ReadonlySet<ActionName>): AssistantCall[] | null {
  if (value !== undefined && !Array.isArray(value)) return null

  const calls: AssistantCall[] = []
  for (const raw of Array.isArray(value) ? value : []) {
    const call = callIn(raw, shown)
    if (!call) return null
    calls.push(call)
  }
  return calls
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
export function parseReply(text: string, shown: ReadonlySet<ActionName>): Reply | null {
  const parsed = jsonIn(text)
  if (!isRecord(parsed)) return null

  const say = typeof parsed.say === 'string' ? parsed.say : ''
  const calls = callsIn(parsed.calls, shown)
  if (!calls) return null

  /**
   * 🛑 Asking WINS, before the calls are even read: told to ask, a model asks and acts in the same
   * breath — `[M]` on qwen3.8, « Crée un nouveau projet » came back with the question and a
   * `command.runStudioCommand` beside it. A plan written before the answer was known is written against a guess.
   */
  const ask = askIn(parsed.ask)
  if (ask) return { say, ask, calls: [] }

  // 🛑 Content that cannot be read REFUSES the whole reply rather than running what stood beside
  // it: a model that meant to stop and ask had its question dropped and its plan carried out.
  if (!asksNothing(parsed.ask)) return null

  // Neither a word nor a deed, which is not an answer a person can be shown — and the check has
  // to sit at the end of EVERY path: an early return let `[1,2,3]` and `{}` through as empty.
  return say.trim() === '' && calls.length === 0 ? null : { say, calls }
}
