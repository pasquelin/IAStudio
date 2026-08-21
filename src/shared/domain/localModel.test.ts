import { describe, expect, it } from 'vitest'
import {
  admitsLoad,
  downloadBytesOf,
  modelRefusalOf,
  type LocalModel,
  type ModelFormat,
  type ModelLoader,
} from './localModel'

const model = (over: Partial<LocalModel> = {}): LocalModel => ({
  id: 'parakeet',
  name: 'Parakeet TDT 0.6b v3',
  format: 'onnx',
  loader: 'sherpa-onnx',
  rank: 1,
  licence: 'CC-BY-4.0',
  licenceUrl: 'https://creativecommons.org/licenses/by/4.0/legalcode',
  source: 'https://huggingface.co/nvidia/parakeet-tdt-0.6b-v3',
  files: [
    { role: 'encoder', name: 'encoder.onnx', url: 'https://x/e', bytes: 652_184_281, sha256: 'a' },
    { role: 'tokens', name: 'tokens.txt', url: 'https://x/t', bytes: 93_939, sha256: 'b' },
  ],
  reservationBytes: 700_000_000,
  ...over,
})

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

describe('downloadBytesOf', () => {
  it('counts what the files weigh, not what the model reserves', () => {
    expect(downloadBytesOf(model())).toBe(652_278_220)
  })
})

describe('modelRefusalOf', () => {
  it('lets through a shipped model whose pair is admitted', () => {
    expect(modelRefusalOf(model())).toBeNull()
  })

  it('refuses a pair the whitelist does not admit', () => {
    expect(modelRefusalOf(model({ format: 'pickle' }))).toBe('format-not-admitted')
    expect(modelRefusalOf(model({ format: 'onnx', loader: 'ollama' }))).toBe('format-not-admitted')
  })

  // ADR-20 § B: supplying one's own manifest must never be the consequence of a click on
  // "Install". The catalogue refuses it; an explicit gesture elsewhere is what admits it.
  it('keeps a manifest supplied by the person out of the catalogue', () => {
    expect(modelRefusalOf(model({ rank: 3 }))).toBe('unverified-provenance')
    expect(modelRefusalOf(model({ rank: 2 }))).toBeNull()
  })
})
