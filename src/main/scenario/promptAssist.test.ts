import { describe, expect, it, vi } from 'vitest'
import type { FieldDescriptor } from '@shared/domain/model'
import { createPromptAssist, type PromptAssistApi, type RemotePrompts } from './promptAssist'

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

const unusedTranslate = (): Promise<never> => Promise.reject(new Error('unused'))
const unusedStyle = (): Promise<never> => Promise.reject(new Error('unused'))
const unusedCaption = (): Promise<never> => Promise.reject(new Error('unused'))

/**
 * Stands in for `AssetInputResolver.resolvePictureIds`. It rewrites rather than passes through, so
 * a request reaching the API with a local id shows up here as a failing expectation.
 */
const resolvePictureIds = (images: readonly string[]): Promise<string[]> =>
  Promise.resolve(images.map(image => (image.startsWith('asset_') ? `remote-of-${image}` : image)))

function assist(answer: RemotePrompts, fields: readonly FieldDescriptor[] = FIELDS) {
  const prompt = vi.fn(async () => answer)
  const api: PromptAssistApi = {
    prompt,
    translate: unusedTranslate,
    describeStyle: unusedStyle,
    caption: unusedCaption,
  }
  return {
    prompt,
    assist: createPromptAssist({ api: () => api, fields: async () => fields, resolvePictureIds }),
  }
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
      translate: unusedTranslate,
      describeStyle: unusedStyle,
      caption: unusedCaption,
    }
    const subject = createPromptAssist({
      api: () => api,
      fields: async () => {
        throw new Error('withdrawn')
      },
      resolvePictureIds,
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

    // The form hands over local ids, which the API has never heard of: left alone it answers as
    // though no reference had been given, and says so nowhere.
    it('passes the references it is given, as the ids the API knows them by', async () => {
      const { prompt, assist: subject } = assist({ prompts: [] })

      await subject.suggest({ modelId: MODEL, images: ['asset_one'] })

      expect(prompt).toHaveBeenCalledWith({
        mode: 'contextual-v2',
        modelId: MODEL,
        images: ['remote-of-asset_one'],
      })
    })

    // A click reaching an unreachable picture must not be answered from the model alone: the
    // suggestion would read as though the reference had been used.
    it('fails rather than ask without the references it could not send', async () => {
      const prompt = vi.fn(async () => ({ prompts: [] }))
      const subject = createPromptAssist({
        api: () => ({
          prompt,
          translate: unusedTranslate,
          describeStyle: unusedStyle,
          caption: unusedCaption,
        }),
        fields: async () => FIELDS,
        resolvePictureIds: () => Promise.reject(new Error('the API does not accept image/tiff')),
      })

      await expect(subject.suggest({ modelId: MODEL, images: ['asset_one'] })).rejects.toThrow(
        'image/tiff',
      )
      expect(prompt).not.toHaveBeenCalled()
    })

    // Nothing to translate, and the transfer must not be reached for on an empty list.
    it('does not resolve pictures when there are none', async () => {
      const resolve = vi.fn(resolvePictureIds)
      const subject = createPromptAssist({
        api: () => ({
          prompt: async () => ({ prompts: [] }),
          translate: unusedTranslate,
          describeStyle: unusedStyle,
          caption: unusedCaption,
        }),
        fields: async () => FIELDS,
        resolvePictureIds: resolve,
      })

      await subject.suggest({ modelId: MODEL, images: [] })

      expect(resolve).not.toHaveBeenCalled()
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

  describe('translate', () => {
    it('carries the draft over and says what it recognized', async () => {
      const translate = vi.fn(async () => ({
        translation: 'a mossy boulder',
        detectedLanguage: 'french',
      }))
      const subject = createPromptAssist({
        api: () => ({
          prompt: async () => ({ prompts: [] }),
          translate,
          describeStyle: unusedStyle,
          caption: unusedCaption,
        }),
        fields: async () => FIELDS,
        resolvePictureIds,
      })

      await expect(subject.translate('un rocher moussu')).resolves.toEqual({
        text: 'a mossy boulder',
        detectedLanguage: 'french',
      })
      expect(translate).toHaveBeenCalledWith({ prompt: 'un rocher moussu' })
    })

    // Nothing is proposed here: what the API answers is the text, whatever it recognized.
    it('reports a draft that was already english without changing it', async () => {
      const subject = createPromptAssist({
        api: () => ({
          prompt: async () => ({ prompts: [] }),
          translate: async () => ({
            translation: 'a mossy boulder',
            detectedLanguage: 'english',
          }),
          describeStyle: unusedStyle,
          caption: unusedCaption,
        }),
        fields: async () => FIELDS,
        resolvePictureIds,
      })

      await expect(subject.translate('a mossy boulder')).resolves.toEqual({
        text: 'a mossy boulder',
        detectedLanguage: 'english',
      })
    })
  })

  describe('describeStyle', () => {
    it('keeps the two texts the API answers with', async () => {
      const describeStyle = vi.fn(async () => ({
        description: 'muted greens under soft overcast light',
        synthesis: 'three forest photographs',
      }))
      const subject = createPromptAssist({
        api: () => ({
          prompt: async () => ({ prompts: [] }),
          translate: unusedTranslate,
          describeStyle,
          caption: unusedCaption,
        }),
        fields: async () => FIELDS,
        resolvePictureIds,
      })

      await expect(subject.describeStyle(['asset_one'])).resolves.toEqual({
        description: 'muted greens under soft overcast light',
        synthesis: 'three forest photographs',
      })
      expect(describeStyle).toHaveBeenCalledWith({ images: ['remote-of-asset_one'] })
    })

    // The read is of the pictures on the form. A local id reaches an API that cannot resolve it,
    // and what comes back is a style description of nothing, worded as though it had seen one.
    it('sends the ids the API knows, not the ids the form carries', async () => {
      const describeStyle = vi.fn(async () => ({ description: 'muted greens', synthesis: 'three' }))
      const subject = createPromptAssist({
        api: () => ({
          prompt: async () => ({ prompts: [] }),
          translate: unusedTranslate,
          describeStyle,
          caption: unusedCaption,
        }),
        fields: async () => FIELDS,
        resolvePictureIds,
      })

      await subject.describeStyle(['asset_one', 'data:image/png;base64,iVBOR', 'asset_two'])

      expect(describeStyle).toHaveBeenCalledWith({
        images: ['remote-of-asset_one', 'data:image/png;base64,iVBOR', 'remote-of-asset_two'],
      })
    })

    it('fails rather than read a style from pictures it could not send', async () => {
      const describeStyle = vi.fn(async () => ({ description: '', synthesis: '' }))
      const subject = createPromptAssist({
        api: () => ({
          prompt: async () => ({ prompts: [] }),
          translate: unusedTranslate,
          describeStyle,
          caption: unusedCaption,
        }),
        fields: async () => FIELDS,
        resolvePictureIds: () => Promise.reject(new Error('offline')),
      })

      await expect(subject.describeStyle(['asset_one'])).rejects.toThrow('offline')
      expect(describeStyle).not.toHaveBeenCalled()
    })
  })

  describe('caption', () => {
    /**
     * The one caller captions assets that have already gone up — `Describable.remoteAssetId` in
     * `assets/auto-caption.ts` — so its ids are the API's own and nothing here can rewrite them.
     * Asked all the same: it runs per arriving asset, and a catalogue hop each would be paid on
     * every import for a rewrite that cannot happen.
     */
    it('sends the ids it is given without asking the catalogue about them', async () => {
      const caption = vi.fn(async () => ({ captions: ['a mossy boulder'] }))
      const resolve = vi.fn(resolvePictureIds)
      const subject = createPromptAssist({
        api: () => ({
          prompt: async () => ({ prompts: [] }),
          translate: unusedTranslate,
          describeStyle: unusedStyle,
          caption,
        }),
        fields: async () => FIELDS,
        resolvePictureIds: resolve,
      })

      await expect(subject.caption(['asset_one'])).resolves.toEqual(['a mossy boulder'])
      expect(caption).toHaveBeenCalledWith({ images: ['asset_one'] })
      expect(resolve).not.toHaveBeenCalled()
    })
  })
})
