import { describe, expect, it } from 'vitest'
import { CLOUD_IDS } from '@shared/domain/aiCloud'
import { readyCloudsOf } from './cloudReadiness'

const anId = CLOUD_IDS[0] ?? ''

describe('readyCloudsOf', () => {
  it('answers for a registered cloud whose account is held', () => {
    expect(readyCloudsOf(new Set([anId]))).toEqual([anId])
    expect(readyCloudsOf(new Set())).toEqual([])
  })

  // The REGISTRY decides what exists; a held key only says whether it can answer.
  it('ignores a key held for a cloud nothing registers', () => {
    expect(readyCloudsOf(new Set(['nowhere']))).toEqual([])
  })
})
