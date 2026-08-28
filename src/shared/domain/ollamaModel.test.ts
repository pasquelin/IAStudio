import { describe, expect, it } from 'vitest'
import { aiRoleId, ASSISTANT_ROLE } from './aiRole'
import { ollamaModel, rolesOfOllamaModel } from './ollamaModel'

const tag = (name: string, size = 4_000_000_000, capabilities?: readonly string[]) => ({
  name,
  size,
  ...(capabilities ? { capabilities } : {}),
})

describe('ollamaModel', () => {
  it('files a chat model under the assistant, and under writing a script', () => {
    const model = ollamaModel(tag('qwen3:8b'))
    expect(model?.id).toBe('qwen3:8b')
    expect(model?.loader).toBe('ollama')
    expect(model?.family).toBeUndefined()
    expect(model?.modality).toBe('text')
    expect(rolesOfOllamaModel(model!)).toEqual([
      ASSISTANT_ROLE,
      aiRoleId('code', 'txt2code'),
      aiRoleId('code', 'code2code'),
    ])
  })

  it('keeps a vision-language model on the assistant — there is no image-analysis employment', () => {
    const model = ollamaModel(tag('llava:7b', 4_000_000_000, ['completion', 'vision']))
    expect(model?.family).toBeUndefined()
    expect(model?.modality).toBe('text')
  })

  it('files an image-generation capability as text-to-image, never as chat', () => {
    const model = ollamaModel(tag('x/z-image-turbo', 6_000_000_000, ['image']))
    expect(model?.family).toBe('image')
    expect(model?.capabilities).toEqual(['txt2img'])
    expect(model?.modality).toBe('image')
    expect(rolesOfOllamaModel(model!)).toEqual([
      aiRoleId('image', 'txt2img'),
      aiRoleId('material', 'txt2img_texture'),
    ])
  })

  it('reads flux in the name as image when Ollama named no capability', () => {
    expect(ollamaModel(tag('x/flux2-klein'))?.family).toBe('image')
  })

  it('refuses embeddings, speech and TTS rather than guessing an employment', () => {
    expect(ollamaModel(tag('nomic-embed-text'))).toBeNull()
    expect(ollamaModel(tag('mxbai-embed-large'))).toBeNull()
    expect(ollamaModel(tag('whisper'))).toBeNull()
    expect(ollamaModel(tag('tts-1'))).toBeNull()
    expect(ollamaModel(tag('qwen3:8b', 1, ['embedding']))).toBeNull()
  })

  it('does not file a llama as an image model', () => {
    expect(ollamaModel(tag('llama3.2:3b', 2_000_000_000, ['completion']))?.family).toBeUndefined()
  })
})
