import type Scenario from '@scenario-labs/sdk'
import type { PromptAssistApi } from './prompt-assist'

/**
 * Binds prompt assistance to the real SDK — the only file where the two meet, like `runner` and
 * `model-catalog` beside it.
 *
 * `generate.prompt` answers with a `Job`, but the prompts and their calls are in the response
 * itself: there is nothing to poll, and nothing here goes near the `JobManager`.
 */
export function promptAssistApiOf(client: Scenario): PromptAssistApi {
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
  }
}
