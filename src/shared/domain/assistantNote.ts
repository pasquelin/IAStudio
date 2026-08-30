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
  /** A round trip leaving: which door carries it, and the WHOLE of what it carries. */
  | { kind: 'sent'; door: string; text: string }
  /** What came back, raw — before `parseReply` has had its say. */
  | { kind: 'answered'; text: string }
  /** One call of the plan, and what the studio answered it. */
  | { kind: 'ran'; action: string; input: string; answer: string; refused: boolean }
  /** A question put to the person, and what they answered — `null` where they dismissed it. */
  | { kind: 'asked'; question: string; answer: string | null }

/** What the window sends of its own accord. The two the brain writes never cross the boundary. */
export type WindowNote = Extract<AssistantNote, { kind: 'ran' | 'asked' }>

/**
 * 🛑 What one note keeps in the JOURNAL, which is a database bounded at 2 000 lines: the prompt
 * runs to 90 505 characters on a door with room (measured 2026-08-30), and a turn writes a line
 * per round trip. The whole of it lives in the transcript file — see `transcript.ts`.
 *
 * The same bound holds the channel a window notes through: a renderer does not decide how much
 * of a database it may take.
 */
export const NOTE_TEXT_MAX = 2000

export const noteText = (text: string): string => clipped(text, NOTE_TEXT_MAX)
