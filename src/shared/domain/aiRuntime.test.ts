import { describe, expect, it } from 'vitest'
import { runtimeEndpointId } from './aiRuntime'

describe('runtimeEndpointId', () => {
  // The measured case ADR-18 exists for: one runtime, two doors, `keep_alive` honoured by one and
  // ignored by the other. Two ids, never one.
  it('names a door rather than a runtime', () => {
    expect(runtimeEndpointId('ollama', 'api-chat')).toBe('ollama/api-chat')
    expect(runtimeEndpointId('ollama', 'v1-chat')).toBe('ollama/v1-chat')
  })

  // The last two are the spellings a looser check would let through: a slash inside a segment
  // makes a three-segment id, and a leading dash makes a second spelling of the same door.
  it('refuses what is not two lowercase kebab-case segments', () => {
    expect(() => runtimeEndpointId('ollama', '')).toThrow()
    expect(() => runtimeEndpointId('', 'api-chat')).toThrow()
    expect(() => runtimeEndpointId('Ollama', 'v1-chat')).toThrow()
    expect(() => runtimeEndpointId('ollama', 'v1-chat/stream')).toThrow()
    expect(() => runtimeEndpointId('ollama', '-api-chat')).toThrow()
  })
})
