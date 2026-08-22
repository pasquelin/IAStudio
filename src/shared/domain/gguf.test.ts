import { describe, expect, it } from 'vitest'
import { ggufHeaderOf, GGUF_MAGIC } from './gguf'

/** The value types, by the numbers `GgufValueType` gives them in `node-llama-cpp`. */
const TYPES = { u32: 4, bool: 7, string: 8, array: 9, u64: 10 }

type Value =
  | { kind: 'string'; text: string }
  | { kind: 'u32'; number: number }
  | { kind: 'u64'; number: number }
  | { kind: 'bool'; flag: boolean }
  | { kind: 'strings'; items: readonly string[] }

type Entry = { key: string; value: Value }

const str = (key: string, text: string): Entry => ({ key, value: { kind: 'string', text } })
const u32 = (key: string, number: number): Entry => ({ key, value: { kind: 'u32', number } })

/**
 * Writes a GGUF head the way the specification describes it — little-endian throughout, strings
 * sized by a 64-bit length.
 *
 * Built here rather than read from a fixture file: the smallest real model is half a gigabyte,
 * and what has to be exercised is the walk, not a particular publisher's metadata.
 */
function ggufBytes(entries: readonly Entry[], version = 3): Uint8Array {
  const parts: number[] = []

  const write32 = (value: number): void => {
    for (let byte = 0; byte < 4; byte += 1) parts.push((value >>> (byte * 8)) & 0xff)
  }
  const u64 = (value: number): void => {
    write32(value)
    write32(0)
  }
  const text = (value: string): void => {
    const bytes = new TextEncoder().encode(value)
    u64(bytes.byteLength)
    parts.push(...bytes)
  }

  write32(GGUF_MAGIC)
  write32(version)
  u64(0)
  u64(entries.length)

  for (const { key, value } of entries) {
    text(key)

    if (value.kind === 'string') {
      write32(TYPES.string)
      text(value.text)
    } else if (value.kind === 'u32') {
      write32(TYPES.u32)
      write32(value.number)
    } else if (value.kind === 'u64') {
      write32(TYPES.u64)
      u64(value.number)
    } else if (value.kind === 'bool') {
      write32(TYPES.bool)
      parts.push(value.flag ? 1 : 0)
    } else {
      write32(TYPES.array)
      write32(TYPES.string)
      u64(value.items.length)
      for (const item of value.items) text(item)
    }
  }

  return new Uint8Array(parts)
}

const QWEN: readonly Entry[] = [
  str('general.architecture', 'qwen2'),
  str('general.name', 'Qwen2.5 7B Instruct'),
  u32('qwen2.context_length', 32_768),
]

describe('ggufHeaderOf', () => {
  it('reads what a manifest needs off the head of the file', () => {
    expect(ggufHeaderOf(ggufBytes(QWEN))).toEqual({
      kind: 'header',
      header: {
        version: 3,
        architecture: 'qwen2',
        name: 'Qwen2.5 7B Instruct',
        contextLength: 32_768,
      },
    })
  })

  /**
   * The metadata of a real model runs to hundreds of entries of every type — a tokenizer alone is
   * an array of tens of thousands of strings. Stepping over them by WIDTH is the whole of the walk,
   * and one wrong width reads everything after it as noise.
   */
  it('walks over the entries it does not read, whatever their type', () => {
    const padded: readonly Entry[] = [
      u32('general.file_type', 15),
      { key: 'tokenizer.ggml.tokens', value: { kind: 'strings', items: ['a', 'b', 'c'] } },
      { key: 'general.quantized', value: { kind: 'bool', flag: true } },
      { key: 'general.size', value: { kind: 'u64', number: 4_683_073_632 } },
      ...QWEN,
    ]

    expect(ggufHeaderOf(ggufBytes(padded))).toMatchObject({
      header: { architecture: 'qwen2', contextLength: 32_768 },
    })
  })

  // The window a caller reads is a guess at how long the metadata is, and a large model's runs
  // past it. Saying so is what lets the caller read further rather than give up.
  it('says a head cut short is truncated, not broken', () => {
    const whole = ggufBytes(QWEN)

    expect(ggufHeaderOf(whole.subarray(0, whole.byteLength - 8))).toEqual({ kind: 'truncated' })
  })

  it('refuses a file that is not one, and a version whose widths differ', () => {
    expect(ggufHeaderOf(new TextEncoder().encode('not a model at all'))).toEqual({
      kind: 'not-gguf',
    })
    expect(ggufHeaderOf(new Uint8Array(4))).toEqual({ kind: 'not-gguf' })
    // Version 1 sized its strings with 32 bits: read as 64 it is noise, so it is refused rather
    // than parsed into a manifest nobody could trust.
    expect(ggufHeaderOf(ggufBytes(QWEN, 1))).toEqual({ kind: 'not-gguf' })
  })

  /**
   * A file may carry the window of an architecture it is NOT — a converted checkpoint keeps the
   * keys of what it came from. The one that governs is the one named after what the file says
   * it is, which is why the entries are collected and resolved at the end rather than as they
   * go past.
   */
  it('takes the window of the architecture the file declares, not the first one it meets', () => {
    const mixed: readonly Entry[] = [u32('llama.context_length', 4_096), ...QWEN]

    expect(ggufHeaderOf(ggufBytes(mixed))).toMatchObject({ header: { contextLength: 32_768 } })
  })

  // A model with no name at all is still readable: the caller falls back to the file's own name,
  // and a manifest that refused to exist over a missing label would be worse.
  it('answers a header with nothing where the file names nothing', () => {
    expect(ggufHeaderOf(ggufBytes([]))).toEqual({
      kind: 'header',
      header: { version: 3, architecture: null, name: null, contextLength: null },
    })
  })
})
