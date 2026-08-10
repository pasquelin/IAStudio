import type { FieldDescriptor } from '@shared/domain/model'
import { clamp } from '@shared/numeric'
import {
  PROMPT_SUGGESTIONS_MAX,
  type PromptSuggestion,
  type PromptStyle,
  type PromptTranslation,
} from '@shared/domain/prompt-assist'
import { adoptableParameters } from './call-parameters'

/**
 * One ready-to-run call the API proposes, index-aligned with the prompt of the same rank.
 * `parameters` is `unknown` in the SDK too — it is the target model's own schema, which is
 * discovered at runtime.
 */
export type RemoteCall = {
  modelId: string
  parameters: unknown
  rationale?: string
}

export type RemotePrompts = {
  prompts: readonly string[]
  calls?: readonly RemoteCall[]
}

/**
 * What prompt assistance needs of the API, and nothing more. Narrow like `ModelCatalog` beside
 * it, for the same reason: it is the whole contract with the outside world, and it is what lets
 * the rules below be tested without a network.
 */
export type PromptAssistApi = {
  prompt: (params: {
    mode: 'contextual-v2'
    modelId?: string
    prompt?: string
    images?: readonly string[]
    numResults?: number
  }) => Promise<RemotePrompts>
  translate: (params: { prompt: string }) => Promise<RemoteTranslation>
  describeStyle: (params: { images: readonly string[] }) => Promise<RemoteStyle>
  caption: (params: { images: readonly string[] }) => Promise<RemoteCaptions>
}

export type RemoteCaptions = {
  /** In the order the images were given — the API says so, and the pairing depends on it. */
  captions: readonly string[]
}

export type RemoteStyle = {
  description: string
  synthesis: string
}

export type RemoteTranslation = {
  translation: string
  detectedLanguage: string
}

export type SuggestRequest = {
  modelId: string
  /** The draft the user has written. Absent lets the API invent from the model alone. */
  prompt?: string
  /** Asset ids or data URLs conditioning the rewrite. */
  images?: readonly string[]
  numResults?: number
}

export type PromptAssistDeps = {
  api: () => PromptAssistApi
  /** The target model's fields, to narrow what the API proposes. Served warm by the registry. */
  fields: (modelId: string) => Promise<readonly FieldDescriptor[]>
}

export type PromptAssist = {
  suggest: (request: SuggestRequest) => Promise<PromptSuggestion[]>
  translate: (draft: string) => Promise<PromptTranslation>
  describeStyle: (images: readonly string[]) => Promise<PromptStyle>
  /** One caption per image, in the order they were given. */
  caption: (images: readonly string[]) => Promise<string[]>
}

/**
 * `contextual-v2` is the mode Prompt Spark v3 runs, and the only one measured to answer with
 * `calls` — complete parameter sets for the target model — rather than prompt text alone. It
 * takes the draft prompt and the reference images together, and accepts fifteen of the latter
 * where the other modes stop at five.
 */
const MODE = 'contextual-v2'

export function createPromptAssist({ api, fields }: PromptAssistDeps): PromptAssist {
  return {
    suggest: async ({ modelId, prompt, images, numResults }) => {
      const answer = await api().prompt({
        mode: MODE,
        modelId,
        // An empty draft is no draft: sent as `""` it reads as an instruction to rewrite
        // nothing, where absent lets the API propose from the model's own examples.
        ...(prompt ? { prompt } : {}),
        ...(images?.length ? { images } : {}),
        ...(numResults ? { numResults: clampResults(numResults) } : {}),
      })

      // The descriptors are fetched once for the whole answer rather than per variant: every
      // call targets the same model, and `describe` is a round trip when the cache is cold.
      const descriptors = await fields(modelId).catch(() => [])

      return answer.prompts.map((text, index) =>
        suggestionOf(text, answer.calls?.[index], modelId, descriptors),
      )
    },

    translate: async draft => {
      const { translation, detectedLanguage } = await api().translate({ prompt: draft })
      return { text: translation, detectedLanguage }
    },

    describeStyle: async images => {
      const { description, synthesis } = await api().describeStyle({ images })
      return { description, synthesis }
    },

    caption: async images => [...(await api().caption({ images })).captions],
  }
}

function clampResults(requested: number): number {
  return clamp(Math.trunc(requested), 1, PROMPT_SUGGESTIONS_MAX)
}

function suggestionOf(
  text: string,
  call: RemoteCall | undefined,
  modelId: string,
  descriptors: readonly FieldDescriptor[],
): PromptSuggestion {
  // A call proposed for another model carries another schema: its text is still worth having,
  // its settings would reach fields this model never declared.
  const settings = call && call.modelId === modelId ? call.parameters : undefined
  const suggestion: PromptSuggestion = {
    text,
    parameters: adoptableParameters(settings, descriptors),
  }

  if (call?.rationale) suggestion.rationale = call.rationale

  return suggestion
}
