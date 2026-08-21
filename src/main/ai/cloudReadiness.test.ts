import { describe, expect, it } from 'vitest'
import { CLOUD_IDS } from '@shared/domain/aiCloud'
import { readyCloudsOf } from './cloudReadiness'

const anId = CLOUD_IDS[0] ?? ''

describe('readyCloudsOf', () => {
  it('answers for a registered cloud whose account is held', () => {
    expect(readyCloudsOf({ [anId]: { held: () => true } })).toEqual([anId])
    expect(readyCloudsOf({ [anId]: { held: () => false } })).toEqual([])
  })

  // The honest answer until something can actually talk to it, and the blind spot the module
  // writes in clear: nothing checks that every registered cloud has a line in the table.
  it('never readies a cloud the wiring has no credentials for', () => {
    expect(readyCloudsOf({})).toEqual([])
  })

  // The REGISTRY decides what exists; credentials only say whether it can answer.
  it('ignores credentials held for a cloud nothing registers', () => {
    expect(readyCloudsOf({ nowhere: { held: () => true } })).toEqual([])
  })
})
