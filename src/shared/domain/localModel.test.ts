import { describe, expect, it } from 'vitest'
import {
  admitsLoad,
  modelRefusalOf,
  provenanceUnverified,
  type ModelFormat,
  type ModelLoader,
} from './localModel'
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

  /**
   * ADR-20 § B as amended: supplying one's own manifest is admitted under an EXPLICIT gesture, and
   * that gesture exists. What rank 3 earns is a mark — never a refusal, which used to make the
   * rank unreachable and every model of it read as incompatible.
   */
  it('admits a manifest the person supplied, and marks it', () => {
    expect(modelRefusalOf(localModel({ rank: 3 }))).toBeNull()
    expect(provenanceUnverified(localModel({ rank: 3 }))).toBe(true)
    expect(provenanceUnverified(localModel({ rank: 1 }))).toBe(false)
  })

  // The whitelist is what decides, and it decides for the person's own file exactly as it does
  // for a shipped one: pointing at something is not a reason to open it.
  it('refuses a format the loader does not admit, whoever supplied it', () => {
    expect(modelRefusalOf(localModel({ rank: 3, format: 'pickle' }))).toBe('format-not-admitted')
  })
})

describe('a manifest that names code beside the weights', () => {
  /**
   * Measured 2026-08-22: on a local folder whose architecture Transformers knows,
   * `from_pretrained` runs a `.py` sitting beside the weights without asking, and
   * `trust_remote_code=False` does not fire. The whitelist is written on (format, loader) and
   * cannot see a file, so this is the only place such an entry is stopped.
   */
  it('is refused whatever its format and loader', () => {
    const model = localModel({
      format: 'safetensors',
      loader: 'diffusers',
      files: [
        { role: 'weights', name: 'model.safetensors', url: 'u', bytes: 1, sha256: 'a' },
        { role: 'code', name: 'custom_model.py', url: 'u', bytes: 1, sha256: 'b' },
      ],
    })

    expect(modelRefusalOf(model)).toBe('weights-carry-code')
  })

  it('is refused for a compiled module as much as for a source one', () => {
    for (const name of ['pipeline.pyc', 'fast.so', 'helper.dylib', 'plugin.dll', 'run.PY']) {
      const model = localModel({
        format: 'safetensors',
        loader: 'diffusers',
        files: [{ role: 'weights', name, url: 'u', bytes: 1, sha256: 'a' }],
      })

      expect(modelRefusalOf(model)).toBe('weights-carry-code')
    }
  })

  it('admits weights and their configuration', () => {
    const model = localModel({
      format: 'safetensors',
      loader: 'diffusers',
      files: [
        {
          role: 'weights',
          name: 'transformer/diffusion_pytorch_model.safetensors',
          url: 'u',
          bytes: 1,
          sha256: 'a',
        },
        { role: 'config', name: 'model_index.json', url: 'u', bytes: 1, sha256: 'b' },
        { role: 'tokenizer', name: 'tokenizer/tokenizer.model', url: 'u', bytes: 1, sha256: 'c' },
      ],
    })

    expect(modelRefusalOf(model)).toBeNull()
  })
})
