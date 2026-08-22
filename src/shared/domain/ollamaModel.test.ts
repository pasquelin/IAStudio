import { describe, expect, it } from 'vitest'
import { ASSISTANT_ROLE } from './aiRole'
import { ollamaModel, rolesOfOllamaModel } from './ollamaModel'

const tag = (name: string, size = 4_000_000_000) => ({ name, size })

describe('ollamaModel', () => {
  it('files a chat model under the assistant', () => {
    const model = ollamaModel(tag('qwen3:8b'))

    expect(model?.id).toBe('qwen3:8b')
    expect(model?.loader).toBe('ollama')
    expect(model?.rank).toBe(2)
    expect(model?.licenceStatus).toBe('restricted')
    expect(rolesOfOllamaModel(model!)).toEqual([ASSISTANT_ROLE])
  })

  it('keeps a vision-language model on the assistant — there is no image-analysis employment', () => {
    expect(ollamaModel(tag('llava:7b'))?.loader).toBe('ollama')
  })

  it('refuses embeddings, speech and TTS rather than guessing an employment', () => {
    expect(ollamaModel(tag('nomic-embed-text'))).toBeNull()
    expect(ollamaModel(tag('mxbai-embed-large'))).toBeNull()
    expect(ollamaModel(tag('whisper'))).toBeNull()
    expect(ollamaModel(tag('tts-1'))).toBeNull()
  })
})
