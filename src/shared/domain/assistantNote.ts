import { clipped } from '../text'

/**
 * What the assistant just did, as a line anyone can read back — the prompt that went out, the
 * answer that came back, each call and what it answered.
 *
 * 🛑 One funnel for two sides: the brain composes and reads in the MAIN process, the chain runs
 * its calls in the WINDOW, and a reader trying to understand a turn needs both in one order.
 * Written where a failure already goes — the studio's own journal — rather than in a surface of
 * its own, which would be a second place to look.
 */
export type AssistantNote =
  /** A round trip leaving: which door carries it, and how much it carries. */
  | { kind: 'sent'; door: string; chars: number; text: string }
  /** What came back, raw — before `parseReply` has had its say. */
  | { kind: 'answered'; chars: number; text: string }
  /** One call of the plan, and what the studio answered it. */
  | { kind: 'ran'; action: string; input: string; answer: string; refused: boolean }
  /** A question put to the person, and what they answered — `null` where they dismissed it. */
  | { kind: 'asked'; question: string; answer: string | null }

/** What the window sends of its own accord. The two the brain writes never cross the boundary. */
export type WindowNote = Extract<AssistantNote, { kind: 'ran' | 'asked' }>

/**
 * 🛑 What ONE note may keep, on either destination. The prompt runs to 90 000 characters on a
 * door with room, and NEITHER can hold that: the journal is a database bounded at 2 000 lines,
 * and the log file rotates at a megabyte — three turns would have turned it over whole.
 *
 * So the whole briefing is kept nowhere, and that is a decision rather than an oversight: its
 * catalogue is the same on every round, and what varies — the sentence, the history, the answer
 * — fits well inside this.
 *
 * 🛑 `chars` is measured BEFORE this cut and travels beside the text: read off the clipped text
 * instead, every line of the journal reported 2 001 characters — and the size is the whole reason
 * a `sent` line exists.
 */
export const NOTE_TEXT_MAX = 2000

export const noteText = (text: string): string => clipped(text, NOTE_TEXT_MAX)
