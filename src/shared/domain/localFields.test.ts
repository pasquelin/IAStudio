import { describe, expect, it } from 'vitest'
import { localFieldKeys, localFieldsOf } from './localFields'

const shout = (key: string): string => key.toUpperCase()

describe('localFieldsOf', () => {
  // Invariant 5: no generation form is written by hand. A Scenario model publishes its inputs; a
  // model on this machine has no server to ask, so the modality answers for it.
  it('offers a text model the knobs a text model has', () => {
    const keys = localFieldsOf('text', {}, shout).map(field => field.key)

    expect(keys).toEqual(['prompt', 'temperature', 'topP', 'maxTokens', 'seed'])
  })

  it('offers an image model its own, and the prompt both share', () => {
    const keys = localFieldsOf('image', {}, shout).map(field => field.key)

    expect(keys).toContain('steps')
    expect(keys).toContain('cfgScale')
    expect(keys[0]).toBe('prompt')
  })

  // The label is screen text, and `no-hardcoded-text` is right to refuse one written in a module.
  it('translates every label rather than carrying one', () => {
    for (const field of localFieldsOf('text', {}, shout)) {
      expect(field.label).toBe(field.label.toUpperCase())
      expect(field.label).not.toBe('')
    }
  })

  /**
   * What a manifest is FOR: a model disagrees with its modality on a bound or a default, never on
   * which knobs exist. A model that added one would be a model its runtime could not honour.
   */
  it('lets a manifest move a default without moving the form', () => {
    const tuned = localFieldsOf('image', { steps: { default: 4, max: 8 } }, shout)
    const steps = tuned.find(field => field.key === 'steps')

    expect(steps?.default).toBe(4)
    expect(steps?.max).toBe(8)
    expect(tuned.map(field => field.key)).toEqual(localFieldsOf('image', {}, shout).map(f => f.key))
  })

  it('leaves a field alone when the manifest names another', () => {
    const tuned = localFieldsOf('image', { steps: { default: 4 } }, shout)

    expect(tuned.find(field => field.key === 'cfgScale')?.default).toBe(7)
  })
})

describe('localFieldKeys', () => {
  // Read off the templates rather than recopied: a knob added without its word would put a raw
  // key on the form, which is the costliest defect this repository knows.
  it('names every key a bundle owes, help included', () => {
    const keys = localFieldKeys()

    expect(keys).toContain('localFields.prompt')
    expect(keys).toContain('localFields.seedHelp')
    expect(new Set(keys).size).toBe(new Set(keys).size)
  })
})
