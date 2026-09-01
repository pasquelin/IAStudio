/**
 * What of a turn fits inside a local model's context window.
 *
 * 🛑 A runtime that overruns its window truncates SILENTLY and cuts from the HEAD, where the
 * studio's preamble sits — ADR-18. Trimming here is what makes the loss ours to choose.
 */

/**
 * `[M]` 4.19 characters per token measured on prompt text of this shape, against Ollama 0.4.6 and
 * `llama3.2:3b` on 2026-08-21. Three, deliberately under it: over-estimating tokens costs a turn
 * of history, under-estimating costs the preamble.
 */
const CHARS_PER_TOKEN = 3

/** Room kept inside the same window for the answer, which is generated into it. */
const REPLY_TOKENS = 1024

/**
 * What a turn's own words are kept, beside the briefing: the sentence typed and one turn of
 * history. Below this the model would be shown a catalogue and asked nothing.
 */
const TURN_TOKENS = 700

/**
 * `[M]` The window the assistant ASKS for, however large the model's own is. Measured 2026-08-29:
 * a 262 144 window composes a 90 298-character briefing — 281 actions, ~30 100 tokens re-read on
 * EVERY round — where 8 192 composes 7 098 and reaches the rest through `actions.find`.
 */
export const ASSISTANT_WINDOW_MAX = 8_192

/** A model's window, capped to what one turn is worth. Never above what the model itself holds. */
export const assistantWindow = (contextTokens: number): number =>
  Math.min(contextTokens, ASSISTANT_WINDOW_MAX)

const estimatedTokens = (text: string): number => Math.ceil(text.length / CHARS_PER_TOKEN)

/**
 * How much briefing a window holds, once the answer and the sentence have their room — the
 * number `studioBriefing` decides what to show from. Characters, because that is what a prompt
 * is counted in here; the conversion is the one measured above.
 */
export function roomFor(contextTokens: number): number {
  return Math.max(0, windowChars(contextTokens) - TURN_TOKENS * CHARS_PER_TOKEN)
}

const windowChars = (contextTokens: number): number =>
  Math.max(0, (contextTokens - REPLY_TOKENS) * CHARS_PER_TOKEN)

/**
 * The sentence, cut to what the window has left once the briefing and the answer have theirs.
 *
 * 🛑 The channel accepts ten thousand characters and a small window holds a third of that, so an
 * uncut paste does not overflow ITSELF: the runtime truncates from the HEAD, where the briefing
 * sits — ADR-18. Cutting the paste is the loss the person can see.
 */
export function sentenceWithin(
  utterance: string,
  briefingLength: number,
  contextTokens: number,
): string {
  return utterance.slice(0, Math.max(0, windowChars(contextTokens) - briefingLength))
}

export type PromptWindow = {
  /** The turns that fit, oldest first — the order the model reads them in. */
  readonly history: readonly string[]
  /** True when the instruction alone does not fit, which no trimming here can fix. */
  readonly overrun: boolean
}

/**
 * The history that fits beside an instruction, dropping the OLDEST turns first. The instruction is
 * never trimmed: it is already capped, and its loss is the one the person could not see.
 */
export function promptWindow(
  instruction: string,
  history: readonly string[],
  contextTokens: number,
): PromptWindow {
  let left = contextTokens - REPLY_TOKENS - estimatedTokens(instruction)
  if (left < 0) return { history: [], overrun: true }

  const kept: string[] = []
  for (const turn of [...history].reverse()) {
    left -= estimatedTokens(turn)
    if (left < 0) break
    kept.unshift(turn)
  }

  return { history: kept, overrun: false }
}
