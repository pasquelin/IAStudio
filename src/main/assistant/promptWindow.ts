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

const estimatedTokens = (text: string): number => Math.ceil(text.length / CHARS_PER_TOKEN)

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
