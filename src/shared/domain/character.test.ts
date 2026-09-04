import { describe, expect, it } from 'vitest'
import { characterExtrasOf } from './character'

describe('character material dress', () => {
  it('reads a complete dress and drops a malformed one from the model metadata', () => {
    expect(
      characterExtrasOf({
        iastudio: { dress: { kind: 'materials', documentIds: ['material-1'] } },
      })?.dress,
    ).toEqual({ kind: 'materials', documentIds: ['material-1'] })

    expect(
      characterExtrasOf({ iastudio: { dress: { kind: 'materials', documentIds: [4] } } }),
    ).toBeNull()
  })
})
