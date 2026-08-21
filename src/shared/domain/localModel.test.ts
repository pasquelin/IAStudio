import { describe, expect, it } from 'vitest'
import { admitsLoad, modelRefusalOf, type ModelFormat, type ModelLoader } from './localModel'
import { localModel } from './localModel-fixtures'

describe('admitsLoad', () => {
  // ADR-20 § A: the whitelist is written on PAIRS, because what makes the studio's ONNX safe is a
  // measured property of its loader — not a property of the format.
  it('admits ONNX for the loader it was measured on, and no other', () => {
    expect(admitsLoad('onnx', 'sherpa-onnx')).toBe(true)
    expect(admitsLoad('onnx', 'ollama')).toBe(false)
    expect(admitsLoad('onnx', 'llamacpp')).toBe(false)
  })

  // Refused, and not "with a warning": pickle executes arbitrary code at read time, and an
  // opt-out that can be configured is one that gets disarmed in silence.
  it('refuses pickle for every loader', () => {
    const loaders: readonly ModelLoader[] = ['sherpa-onnx', 'ollama', 'llamacpp']

    for (const loader of loaders) expect(admitsLoad('pickle', loader)).toBe(false)
  })

  it('admits the formats designed not to execute anything', () => {
    const formats: readonly ModelFormat[] = ['safetensors', 'gguf']

    for (const format of formats) expect(admitsLoad(format, 'llamacpp')).toBe(true)
  })
})

describe('modelRefusalOf', () => {
  it('lets through a shipped model whose pair is admitted', () => {
    expect(modelRefusalOf(localModel())).toBeNull()
  })

  it('refuses a pair the whitelist does not admit', () => {
    expect(modelRefusalOf(localModel({ format: 'pickle' }))).toBe('format-not-admitted')
    expect(modelRefusalOf(localModel({ format: 'onnx', loader: 'ollama' }))).toBe(
      'format-not-admitted',
    )
  })

  // ADR-20 § B: supplying one's own manifest must never be the consequence of a click on
  // "Install". The catalogue refuses it; an explicit gesture elsewhere is what admits it.
  it('keeps a manifest supplied by the person out of the catalogue', () => {
    expect(modelRefusalOf(localModel({ rank: 3 }))).toBe('unverified-provenance')
    expect(modelRefusalOf(localModel({ rank: 2 }))).toBeNull()
  })
})
