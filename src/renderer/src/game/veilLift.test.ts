import { describe, expect, it } from 'vitest'
import { veilLift } from './veilLift'

describe('the veil an arrival fade still owes', () => {
  it('lifts from full to nothing over the span it was given', () => {
    expect(veilLift(0, 2, 0)).toEqual({ veil: 1, through: false })
    expect(veilLift(1, 2, 0)).toEqual({ veil: 0.5, through: false })
  })

  it('says the lift is through once the span has run out', () => {
    expect(veilLift(2, 2, 0)).toEqual({ veil: 0, through: true })
  })

  /** 🛑 A transition in the arrived timeline's first seconds was overwritten by the lift, every step. */
  it('holds the deeper of the lift and what the arrived timeline has already written', () => {
    expect(veilLift(1.5, 2, 0.8).veil).toBe(0.8)
  })

  /** Through, and still dark: the timeline that wrote it owns the picture from here. */
  it('keeps what the timeline wrote after the lift is through', () => {
    expect(veilLift(3, 2, 0.4)).toEqual({ veil: 0.4, through: true })
  })
})
