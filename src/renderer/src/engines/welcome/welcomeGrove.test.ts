import { describe, expect, it } from 'vitest'
import {
  welcomeClearanceOf,
  welcomeGroveAllows,
  welcomeGroveOpens,
  WELCOME_GROVE,
  WELCOME_YARD,
  WELCOME_YARD_AT,
} from './welcomeGrove'

describe('the welcome grove', () => {
  it('leaves the middle open, which is where the walk and the reader both look', () => {
    expect(welcomeGroveAllows(WELCOME_GROVE, WELCOME_YARD_AT.x, WELCOME_YARD_AT.z)).toBe(true)
  })

  it('never lets two planters touch, or the grove reads as one clump', () => {
    const pairs = WELCOME_GROVE.flatMap((one, index) =>
      WELCOME_GROVE.slice(index + 1).map(other => ({ one, other })),
    )

    for (const { one, other } of pairs) {
      expect(Math.hypot(one.x - other.x, one.z - other.z)).toBeGreaterThan(
        one.planter + other.planter + 1,
      )
    }
  })

  it('refuses the ground a planter stands on, corners included', () => {
    // Stood in the MIDDLE of the yard: the shipped grove rings it from outside, where a step clear
    // of a planter is still a step past the rim, and the two refusals would read as one.
    const tree = { ...WELCOME_YARD_AT, height: 1, crown: 1, planter: 0.6, turn: 0 }

    expect(welcomeGroveAllows([tree], tree.x, tree.z)).toBe(false)
    expect(welcomeGroveAllows([tree], tree.x + welcomeClearanceOf(tree) + 0.01, tree.z)).toBe(true)
  })

  it('refuses the ground past the yard, however empty it is — on either half of the ellipse', () => {
    expect(
      welcomeGroveAllows([], WELCOME_YARD_AT.x + WELCOME_YARD.x + 0.5, WELCOME_YARD_AT.z),
    ).toBe(false)
    expect(
      welcomeGroveAllows([], WELCOME_YARD_AT.x, WELCOME_YARD_AT.z + WELCOME_YARD.z + 0.5),
    ).toBe(false)
  })

  it('reads a heading as blocked when the tree is ahead rather than merely near', () => {
    const from = { x: WELCOME_YARD_AT.x, z: WELCOME_YARD_AT.z }
    const tree = { ...from, z: from.z + 3, height: 1, crown: 1, planter: 0.6, turn: 0 }

    expect(welcomeGroveOpens([tree], { ...from, heading: 0 }, 2.5)).toBe(false)
    expect(welcomeGroveOpens([tree], { ...from, heading: Math.PI }, 2.5)).toBe(true)
  })
})
