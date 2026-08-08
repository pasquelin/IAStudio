import { describe, expect, it, vi } from 'vitest'
import { promptAssistApiOf, type PromptEndpoints } from './prompt-assist-api'

function endpoints(overrides: Partial<PromptEndpoints['generate']> = {}): PromptEndpoints {
  return {
    generate: {
      prompt: async () => ({ prompts: [] }),
      translate: async () => ({ translation: '', detectedLanguage: 'english' }),
      describeStyle: async () => ({ description: '', synthesis: '' }),
      caption: async () => ({ captions: [] }),
      ...overrides,
    },
  }
}

describe('promptAssistApiOf', () => {
  it('carries the answer through as the port describes it', async () => {
    const api = promptAssistApiOf(
      endpoints({
        prompt: async () => ({
          prompts: ['a close-up'],
          calls: [{ modelId: 'model_flux', parameters: { resolution: '4K' } }],
        }),
      }),
    )

    await expect(api.prompt({ mode: 'contextual-v2', modelId: 'model_flux' })).resolves.toEqual({
      prompts: ['a close-up'],
      calls: [{ modelId: 'model_flux', parameters: { resolution: '4K' } }],
    })
  })

  it('passes the request through untouched when it carries no reference', async () => {
    const prompt = vi.fn(async () => ({ prompts: [] }))
    const api = promptAssistApiOf(endpoints({ prompt }))

    await api.prompt({ mode: 'contextual-v2', modelId: 'model_flux', prompt: 'a boulder' })

    expect(prompt).toHaveBeenCalledWith({
      mode: 'contextual-v2',
      modelId: 'model_flux',
      prompt: 'a boulder',
    })
  })

  // The SDK asks for a mutable array, so the readonly one the port hands out cannot travel.
  it('copies the references rather than handing the caller list to the SDK', async () => {
    const prompt = vi.fn<PromptEndpoints['generate']['prompt']>(async () => ({ prompts: [] }))
    const api = promptAssistApiOf(endpoints({ prompt }))
    const images: readonly string[] = ['asset_one']

    await api.prompt({ mode: 'contextual-v2', modelId: 'model_flux', images })

    const sent = prompt.mock.calls[0]?.[0]
    expect(sent).toEqual({ mode: 'contextual-v2', modelId: 'model_flux', images: ['asset_one'] })
    expect(sent?.images).not.toBe(images)
  })

  it('keeps a translation to the two fields the studio reads', async () => {
    const api = promptAssistApiOf(
      endpoints({
        translate: async () => ({
          translation: 'a mossy boulder',
          detectedLanguage: 'french',
        }),
      }),
    )

    await expect(api.translate({ prompt: 'un rocher moussu' })).resolves.toEqual({
      translation: 'a mossy boulder',
      detectedLanguage: 'french',
    })
  })

  it('copies the references of a style request too', async () => {
    const describeStyle = vi.fn<PromptEndpoints['generate']['describeStyle']>(async () => ({
      description: 'a style',
      synthesis: 'two pictures',
    }))
    const api = promptAssistApiOf(endpoints({ describeStyle }))
    const images: readonly string[] = ['asset_one']

    await expect(api.describeStyle({ images })).resolves.toEqual({
      description: 'a style',
      synthesis: 'two pictures',
    })
    expect(describeStyle.mock.calls[0]?.[0].images).not.toBe(images)
  })
})
