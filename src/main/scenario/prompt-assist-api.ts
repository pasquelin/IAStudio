import type {
  PromptAssistApi,
  RemotePrompts,
  RemoteStyle,
  RemoteTranslation,
} from './prompt-assist'

/**
 * The slice of the SDK prompt assistance touches.
 *
 * Structural rather than `Scenario` itself, so the mapping below can be tested without standing
 * a whole client up — `runner` and `model-catalog` beside it pay that price and go untested. The
 * real client is still checked against this at the call site: a shape the SDK stops honouring is
 * a compile error, not a surprise at runtime.
 */
export type PromptEndpoints = {
  generate: {
    prompt: (params: {
      mode: 'contextual-v2'
      modelId?: string
      prompt?: string
      images?: string[]
      numResults?: number
    }) => Promise<RemotePrompts>
    translate: (params: { prompt: string }) => Promise<RemoteTranslation>
    describeStyle: (params: { images: string[] }) => Promise<RemoteStyle>
  }
}

/**
 * Binds prompt assistance to the real SDK — the only file where the two meet.
 *
 * `generate.prompt` answers with a `Job`, but the prompts and their calls are in the response
 * itself: there is nothing to poll, and nothing here goes near the `JobManager`.
 */
export function promptAssistApiOf(client: PromptEndpoints): PromptAssistApi {
  return {
    // Copied because the SDK asks for a mutable array; the port hands out a readonly one so no
    // caller can believe its own list travelled.
    prompt: async ({ images, ...rest }) => {
      const { prompts, calls } = await client.generate.prompt({
        ...rest,
        ...(images ? { images: [...images] } : {}),
      })
      return { prompts, calls }
    },

    translate: async params => {
      const { translation, detectedLanguage } = await client.generate.translate(params)
      return { translation, detectedLanguage }
    },

    // Copied for the same reason as the references above.
    describeStyle: async ({ images }) => {
      const { description, synthesis } = await client.generate.describeStyle({
        images: [...images],
      })
      return { description, synthesis }
    },
  }
}
