import { aiRoleId, ASSISTANT_ROLE, type AiRoleId } from './aiRole'
import type { LocalModel } from './localModel'

/**
 * A row `/api/tags` answers — name and size are what the catalogue needs; capabilities, when
 * present, say what the weights actually do.
 */
export type OllamaTag = {
  readonly name: string
  readonly size: number
  readonly capabilities?: readonly string[]
}

/**
 * Names that are not a conversation. A tag matching this is skipped rather than filed under the
 * assistant: an embedding or a TTS model answering ⌘K is the mapping this exists to prevent.
 */
const NOT_CHAT = /embed|whisper|\btts\b|bark|xtts|\brvc\b|all-minilm/i

/** Names that generate a picture, used only when `/api/show` named no capability. */
const IMAGE_NAME = /flux|z-image|sdxl|stable-diffusion|image-turbo|\bimagen\b/i

function capabilitiesOf(tag: OllamaTag): readonly string[] {
  if (tag.capabilities && tag.capabilities.length > 0) return tag.capabilities
  if (NOT_CHAT.test(tag.name)) return ['embedding']
  if (IMAGE_NAME.test(tag.name)) return ['image']
  return ['completion']
}

function baseOf(tag: OllamaTag): Omit<LocalModel, 'modality'> {
  return {
    id: tag.name,
    name: tag.name,
    format: 'gguf',
    loader: 'ollama',
    rank: 2,
    licence: '',
    licenceUrl: '',
    source: 'http://127.0.0.1:11434',
    files: [],
    diskBytes: tag.size,
    reservationBytes: tag.size,
    contextTokens: 4096,
    licenceStatus: 'restricted',
  }
}

/**
 * A discovered Ollama tag as a catalogue entry, or nothing when it cannot serve an employment.
 *
 * Rank 2: the studio named the endpoint, not the weights. Capabilities come from Ollama when it
 * sends them; a llama is never filed as an image model.
 */
export function ollamaModel(tag: OllamaTag): LocalModel | null {
  if (NOT_CHAT.test(tag.name)) return null

  const caps = capabilitiesOf(tag)
  if (caps.includes('embedding')) return null

  if (caps.includes('image')) {
    return {
      ...baseOf(tag),
      family: 'image',
      capabilities: ['txt2img'],
      serves: [aiRoleId('material', 'txt2img_texture')],
      modality: 'image',
    }
  }

  if (caps.includes('completion') || caps.includes('vision') || caps.includes('tools')) {
    return { ...baseOf(tag), modality: 'text' }
  }

  return null
}

/** What a discovered Ollama model may be chosen for — never a role it cannot produce. */
export function rolesOfOllamaModel(model: LocalModel): readonly AiRoleId[] {
  if (model.loader !== 'ollama') return []
  if (model.family === 'image') {
    return [aiRoleId('image', 'txt2img'), aiRoleId('material', 'txt2img_texture')]
  }
  return [ASSISTANT_ROLE]
}
