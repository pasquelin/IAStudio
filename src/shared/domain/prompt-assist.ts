/**
 * Prompt assistance, as the renderer sees it.
 *
 * The four endpoints behind these types (`generate.prompt`, `caption`, `describe_style`,
 * `translate`) look asynchronous — each answers with a `Job` — but their result is in the POST
 * response itself. The job is only there for tracing and billing: there is nothing to poll,
 * which is why none of this goes through the `JobManager`.
 */

/** One rewritten prompt, with the model settings Prompt Spark proposes alongside it. */
export type PromptSuggestion = {
  text: string
  /**
   * Already narrowed to what the target model declares: the main process filters the API's
   * proposal against the model's own descriptors, so nothing here reaches a field that does
   * not exist. Empty when the API proposed no settings, never absent.
   */
  parameters: Record<string, unknown>
  /** Why the API proposed this call, when it says. */
  rationale?: string
}

/** What the renderer asks for when it wants a draft rewritten. */
export type SuggestPromptsRequest = {
  modelId: string
  /** The draft as it stands. Absent lets the API propose from the model's own examples. */
  prompt?: string
  /** Asset ids conditioning the rewrite — the references already on the form. */
  images?: readonly string[]
  numResults?: number
}

/**
 * How many variants one request may ask for. The API's own bound — asking for more is a 400,
 * and the renderer must not be able to send one.
 */
export const PROMPT_SUGGESTIONS_MAX = 5

/** Enough to compare without scrolling a panel that is a third of a window wide. */
export const PROMPT_SUGGESTIONS_DEFAULT = 3

/**
 * How many references one rewrite may be conditioned on. `contextual-v2` accepts fifteen where
 * the other modes stop at five — see `docs/scenario-api/reference/generate.prompt.md`.
 */
export const PROMPT_IMAGES_MAX = 15

/**
 * The longest draft worth sending. Far under the API's own cap — 250 000 characters on the
 * model measured — because this channel answers with a handful of sentences, and a renderer
 * must not be able to push a megabyte through it.
 */
export const PROMPT_INPUT_MAX = 8000
