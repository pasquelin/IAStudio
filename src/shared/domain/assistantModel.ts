/**
 * Which language model the assistant thinks with, and what that costs.
 *
 * Its own module for the reason `assistantAction.ts` is one: `settings.ts` carries the chosen
 * model as a setting, and reading it out of the registry closed the loop
 * `assistant.ts → settings.ts → …Actions.ts → assistant.ts` the day a family read a settings
 * constant. `import-cycles.test.ts` holds that count at zero.
 *
 * `assistant.ts` re-exports all of this, so nothing outside had to change.
 */

/**
 * The catalogue model the assistant thinks with. One model, whose own `model` parameter picks
 * which language model actually answers.
 *
 * It is an ordinary model of the catalogue, which is the whole reason the assistant needs no
 * second account and no second key: it goes through `ModelRegistry`, the `JobManager`, the rate
 * limiter and the cost meter that are already there.
 */
export const ASSISTANT_MODEL_ID = 'model_scenario-llm'

/**
 * Which language model answers, and what it costs.
 *
 * Measured with `dryRun` on 2026-08-15, for one short instruction: Haiku 4.5 at 0.75 creative
 * units, Gemini 3.5 Flash at 1, Opus 4.8 at 2.75. Ten blocks of history take Haiku from 0.75 to
 * 1 — so a five-turn conversation costs about what one picture does, which is why the modal
 * shows the running total rather than leaving it to be discovered on the invoice.
 *
 * The full list the API accepts is wider; these are the four worth offering. Haiku is the
 * default: routing a sentence to an action is not the work that needs the best model.
 */
export type AssistantModel =
  'claude-haiku-4-5' | 'claude-sonnet-4-6' | 'claude-opus-4-8' | 'gemini-3.5-flash'

export const ASSISTANT_MODELS: readonly AssistantModel[] = [
  'claude-haiku-4-5',
  'claude-sonnet-4-6',
  'claude-opus-4-8',
  'gemini-3.5-flash',
]

export const DEFAULT_ASSISTANT_MODEL: AssistantModel = 'claude-haiku-4-5'

export const HISTORY_MAX = 10
