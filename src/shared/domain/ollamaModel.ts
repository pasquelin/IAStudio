import { aiRoleId, type AiRoleId } from './aiRole'
import type { LocalModel } from './localModel'

/**
 * A row `/api/tags` answers — name and size are what the catalogue needs; capabilities, when
 * present, say what the weights actually do.
 */
export type OllamaTag = {
  readonly name: string
  readonly size: number
  readonly capabilities?: readonly string[]
  /**
   * The window the weights were built with, as `/api/tags` publishes it under `details`.
   *
   * 🛑 Asked for WHOLE, never capped. Measured on 2026-08-28 against `qwen3.8:latest` (27,3 B,
   * Q4_K_M): 18,0 Go loaded at `num_ctx` 4 096 against 18,6 Go at 262 144 — sixty-four times the
   * window for 0,6 Go, so a ceiling would cost the catalogue and save nothing.
   */
  readonly contextTokens?: number
}

/** What a tag that publishes no window is asked for — the figure Ollama itself defaults to. */
const OLLAMA_FALLBACK_TOKENS = 4096

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
    // 🛑 4 096 was written here for EVERY discovered model, and Ollama publishes the true figure:
    // qwen3.8 answers 262 144, so the assistant was shown fourteen actions of the whole registry.
    contextTokens: tag.contextTokens ?? OLLAMA_FALLBACK_TOKENS,
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
    // `serves` and not a family: these weights are a conversation first, and writing a script is
    // one round trip against them. It is also what tells the local runner which prompt to compose.
    return { ...baseOf(tag), modality: 'text', serves: [...CODE_ROLES] }
  }

  return null
}

/** The employments a conversation serves beyond the assistant: writing a script, and reworking one. */
const CODE_ROLES: readonly AiRoleId[] = [
  aiRoleId('code', 'txt2code'),
  aiRoleId('code', 'code2code'),
]
