import { ASSISTANT_ROLE } from './aiRole'
import type { LocalModel } from './localModel'

/**
 * A row `/api/tags` answers — name and size are what the catalogue needs; the rest is decoration.
 */
export type OllamaTag = {
  readonly name: string
  readonly size: number
}

/**
 * Names that are not a conversation. A tag matching this is skipped rather than filed under the
 * assistant: an embedding or a TTS model answering ⌘K is the mapping this exists to prevent.
 */
const NOT_CHAT = /embed|whisper|\btts\b|bark|xtts|\brvc\b|all-minilm/i

/**
 * A discovered Ollama tag as a catalogue entry, or nothing when it cannot serve an employment.
 *
 * Rank 2: the studio named the endpoint, not the weights. `restricted` rather than `commercial` —
 * nothing here has read a licence. Empty `files`: Ollama pulls; no digest we could verify.
 */
export function ollamaModel(tag: OllamaTag): LocalModel | null {
  if (NOT_CHAT.test(tag.name)) return null

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
    modality: 'text',
    licenceStatus: 'restricted',
  }
}

/** Every discovered chat model serves the assistant and nothing else — never 3D, never TTS. */
export function rolesOfOllamaModel(model: LocalModel): readonly (typeof ASSISTANT_ROLE)[] {
  return model.loader === 'ollama' ? [ASSISTANT_ROLE] : []
}
