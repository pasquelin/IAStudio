import { describe, expect, it } from 'vitest'
import { digest, stableKey } from './hash'

describe('digest', () => {
  it('answers the same sixteen characters for the same string', () => {
    expect(digest('imageGenerator1')).toBe(digest('imageGenerator1'))
    expect(digest('imageGenerator1')).toHaveLength(16)
  })

  it('separates strings that differ by one character', () => {
    expect(digest('a knight on a horse')).not.toBe(digest('a knight on a house'))
    expect(digest('')).not.toBe(digest('a'))
  })

  it('reads past the first byte of a multi-byte character', () => {
    expect(digest('chevalier à cheval')).not.toBe(digest('chevalier â cheval'))
  })
})

describe('stableKey', () => {
  it('spells an object the same way whatever order its keys were written in', () => {
    expect(stableKey({ prompt: 'a knight', width: 512 })).toBe(
      stableKey({ width: 512, prompt: 'a knight' }),
    )
  })

  it('sorts the keys of a nested object too', () => {
    expect(stableKey({ form: { b: 1, a: 2 } })).toBe(stableKey({ form: { a: 2, b: 1 } }))
  })

  it('keeps the order of an array, which is data rather than spelling', () => {
    expect(stableKey(['a', 'b'])).not.toBe(stableKey(['b', 'a']))
  })

  it('separates a number from the string of the same digits', () => {
    expect(stableKey({ seed: 1 })).not.toBe(stableKey({ seed: '1' }))
  })

  it('leaves out a key holding undefined, as JSON.stringify does', () => {
    expect(stableKey({ prompt: 'a knight', mask: undefined })).toBe(
      stableKey({ prompt: 'a knight' }),
    )
  })

  it('writes undefined inside an array as null, which is what JSON.stringify writes', () => {
    // A hole in an array is a position, so it cannot simply be dropped the way a key is.
    expect(stableKey([undefined, 1])).toBe(stableKey([null, 1]))
  })

  it('does not confuse a key holding undefined with one holding null', () => {
    expect(stableKey({ mask: null })).not.toBe(stableKey({ mask: undefined }))
  })

  it('leaves out what JSON cannot carry either, rather than throwing on it', () => {
    const marker = Symbol('marker')

    expect(stableKey({ prompt: 'a knight', onDone: () => undefined })).toBe(
      stableKey({ prompt: 'a knight' }),
    )
    expect(stableKey({ prompt: 'a knight', tag: marker })).toBe(stableKey({ prompt: 'a knight' }))
  })

  it('separates an absent key from one holding an empty string', () => {
    expect(stableKey({})).not.toBe(stableKey({ prompt: '' }))
  })
})
