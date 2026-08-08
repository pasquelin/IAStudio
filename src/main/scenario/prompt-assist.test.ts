import { describe, expect, it, vi } from 'vitest'
import type { FieldDescriptor } from '@shared/domain/model'
import { createPromptAssist, type PromptAssistApi, type RemotePrompts } from './prompt-assist'

const MODEL = 'model_google-gemini-3-1-flash'

const FIELDS: FieldDescriptor[] = [
  { key: 'prompt', kind: 'longText', label: 'Prompt', required: true },
  {
    key: 'resolution',
    kind: 'choice',
    label: 'Resolution',
    required: false,
    options: [
      { value: '1K', label: '1K' },
      { value: '4K', label: '4K' },
    ],
  },
  { key: 'numOutputs', kind: 'integer', label: 'Outputs', required: false, min: 1, max: 4 },
]

function assist(answer: RemotePrompts, fields: readonly FieldDescriptor[] = FIELDS) {
  const prompt = vi.fn(async () => answer)
  const api: PromptAssistApi = { prompt }
  return { prompt, assist: createPromptAssist({ api: () => api, fields: async () => fields }) }
}

describe('createPromptAssist', () => {
  it('pairs each prompt with the settings of the same rank', async () => {
    const { assist: subject } = assist({
      prompts: ['a close-up', 'a wide shot'],
      calls: [
        { modelId: MODEL, parameters: { resolution: '4K' } },
        { modelId: MODEL, parameters: { resolution: '1K' } },
      ],
    })

    await expect(subject.suggest({ modelId: MODEL })).resolves.toEqual([
      { text: 'a close-up', parameters: { resolution: '4K' } },
      { text: 'a wide shot', parameters: { resolution: '1K' } },
    ])
  })

  it('narrows the proposed settings to what the model declares', async () => {
    const { assist: subject } = assist({
      prompts: ['a close-up'],
      calls: [
        { modelId: MODEL, parameters: { resolution: '4K', invented: 'nope', numOutputs: 9 } },
      ],
    })

    const suggestions = await subject.suggest({ modelId: MODEL })

    expect(suggestions[0]?.parameters).toEqual({ resolution: '4K' })
  })

  it('answers empty settings when the API proposed no call', async () => {
    const { assist: subject } = assist({ prompts: ['a close-up'] })

    await expect(subject.suggest({ modelId: MODEL })).resolves.toEqual([
      { text: 'a close-up', parameters: {} },
    ])
  })

  // A call for another model carries another schema entirely.
  it('keeps the text but drops the settings when the call targets another model', async () => {
    const { assist: subject } = assist({
      prompts: ['a close-up'],
      calls: [{ modelId: 'model_elsewhere', parameters: { resolution: '4K' } }],
    })

    await expect(subject.suggest({ modelId: MODEL })).resolves.toEqual([
      { text: 'a close-up', parameters: {} },
    ])
  })

  it('carries the rationale when the API gives one, and omits it otherwise', async () => {
    const { assist: subject } = assist({
      prompts: ['a close-up', 'a wide shot'],
      calls: [
        { modelId: MODEL, parameters: {}, rationale: 'macro reads the moss' },
        { modelId: MODEL, parameters: {} },
      ],
    })

    const suggestions = await subject.suggest({ modelId: MODEL })

    expect(suggestions[0]?.rationale).toBe('macro reads the moss')
    expect(suggestions[1]).not.toHaveProperty('rationale')
  })

  it('still answers when the model can no longer be described', async () => {
    const api: PromptAssistApi = {
      prompt: async () => ({
        prompts: ['a close-up'],
        calls: [{ modelId: MODEL, parameters: { resolution: '4K' } }],
      }),
    }
    const subject = createPromptAssist({
      api: () => api,
      fields: async () => {
        throw new Error('withdrawn')
      },
    })

    await expect(subject.suggest({ modelId: MODEL })).resolves.toEqual([
      { text: 'a close-up', parameters: {} },
    ])
  })

  describe('the request it sends', () => {
    it('asks in the one mode that answers with complete calls', async () => {
      const { prompt, assist: subject } = assist({ prompts: [] })

      await subject.suggest({ modelId: MODEL, prompt: 'a boulder' })

      expect(prompt).toHaveBeenCalledWith({
        mode: 'contextual-v2',
        modelId: MODEL,
        prompt: 'a boulder',
      })
    })

    // Sent as `""` it reads as an instruction to rewrite nothing.
    it('omits an empty draft rather than sending it', async () => {
      const { prompt, assist: subject } = assist({ prompts: [] })

      await subject.suggest({ modelId: MODEL, prompt: '' })

      expect(prompt).toHaveBeenCalledWith({ mode: 'contextual-v2', modelId: MODEL })
    })

    it('omits an empty image list', async () => {
      const { prompt, assist: subject } = assist({ prompts: [] })

      await subject.suggest({ modelId: MODEL, images: [] })

      expect(prompt).toHaveBeenCalledWith({ mode: 'contextual-v2', modelId: MODEL })
    })

    it('passes the references it is given', async () => {
      const { prompt, assist: subject } = assist({ prompts: [] })

      await subject.suggest({ modelId: MODEL, images: ['asset_one'] })

      expect(prompt).toHaveBeenCalledWith({
        mode: 'contextual-v2',
        modelId: MODEL,
        images: ['asset_one'],
      })
    })

    it('never asks for more variants than the API accepts', async () => {
      const { prompt, assist: subject } = assist({ prompts: [] })

      await subject.suggest({ modelId: MODEL, numResults: 99 })

      expect(prompt).toHaveBeenCalledWith({
        mode: 'contextual-v2',
        modelId: MODEL,
        numResults: 5,
      })
    })

    it('never asks for fewer than one', async () => {
      const { prompt, assist: subject } = assist({ prompts: [] })

      await subject.suggest({ modelId: MODEL, numResults: -3 })

      expect(prompt).toHaveBeenCalledWith({
        mode: 'contextual-v2',
        modelId: MODEL,
        numResults: 1,
      })
    })
  })
})
