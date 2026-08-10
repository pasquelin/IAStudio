import { describe, expect, it } from 'vitest'
import { isBeyondPlan, levelOfPlan, type PlanAccess } from './plan'

describe('levelOfPlan', () => {
  // The two the account actually answered: `cu-basic` runs models graded 25 and is refused at
  // 50, naming `cu-pro-q3-25`. Everything else on the scale is the SDK's documentation.
  it('reads the two plan names the API was measured answering', () => {
    expect(levelOfPlan('cu-basic')).toBe(25)
    expect(levelOfPlan('cu-pro-q3-25')).toBe(50)
  })

  it('reads a name whatever quarter it was priced in', () => {
    expect(levelOfPlan('cu-pro-q1-27')).toBe(50)
    expect(levelOfPlan('cu-team-q4-26')).toBe(75)
  })

  it('answers nothing for a name it does not recognise', () => {
    expect(levelOfPlan('cu-something-new')).toBeNull()
    expect(levelOfPlan('')).toBeNull()
  })

  // Under-reading a plan greys out models the user is paying for; over-reading only lets the
  // API answer the 403 it would have answered anyway.
  it('takes the highest segment it recognises, never the first', () => {
    expect(levelOfPlan('cu-basic-pro')).toBe(50)
    expect(levelOfPlan('cu-enterprise-free')).toBe(100)
  })
})

describe('isBeyondPlan', () => {
  const basic: PlanAccess = { name: 'cu-basic', level: 25 }

  it('refuses a model graded above the plan', () => {
    expect(isBeyondPlan(50, basic)).toBe(true)
    expect(isBeyondPlan(75, basic)).toBe(true)
  })

  it('allows a model graded at or below the plan', () => {
    expect(isBeyondPlan(25, basic)).toBe(false)
    expect(isBeyondPlan(0, basic)).toBe(false)
    // Measured on two public models, and outside the union the SDK declares for the field.
    expect(isBeyondPlan(1, basic)).toBe(false)
  })

  // Being wrong here hides a model that would have run, so every unknown reads as allowed.
  it('allows anything when either side is unknown', () => {
    expect(isBeyondPlan(undefined, basic)).toBe(false)
    expect(isBeyondPlan(100, null)).toBe(false)
    expect(isBeyondPlan(100, { name: 'cu-something-new', level: null })).toBe(false)
  })
})
