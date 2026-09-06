// SPDX-License-Identifier: MIT

import { describe, expect, it } from 'vitest'
import { createIntents } from './intents'

describe('what a script asks of a body', () => {
  it('answers nothing for a body nobody spoke for', () => {
    const intents = createIntents()

    expect(intents.walkOf('a')).toBeNull()
    expect(intents.jumped('a')).toBe(false)
    expect(intents.driveOf('a')).toBeNull()
    expect(intents.flyOf('a')).toBeNull()
  })

  /** 🛑 The z of a script and the y of a stick both go backwards — normalised on the way in. */
  it('hands a walk back in the shape a stick speaks', () => {
    const intents = createIntents()

    intents.walk('a', 1, -2)

    expect(intents.walkOf('a')).toEqual({ x: 1, y: -2 })
  })

  it('keeps one body apart from another', () => {
    const intents = createIntents()

    intents.drive('a', 1, 0, false)

    expect(intents.driveOf('b')).toBeNull()
  })

  /** Last writer wins: two scripts on one body resolve by entity order, which nothing shows. */
  it('keeps the last ask when two of them name the same body', () => {
    const intents = createIntents()

    intents.walk('a', 0, 0)
    intents.walk('a', 1, 0)

    expect(intents.walkOf('a')).toEqual({ x: 1, y: 0 })
  })

  it('drops everything on release, so a silent step hands the sticks back', () => {
    const intents = createIntents()
    intents.walk('a', 1, 0)
    intents.jump('a')
    intents.look('a', 1, 0)
    intents.fly('a', 1, 0, 0, 1)

    intents.release()

    expect(intents.walkOf('a')).toBeNull()
    expect(intents.jumped('a')).toBe(false)
    expect(intents.lookOf('a')).toBeNull()
    expect(intents.flyOf('a')).toBeNull()
  })
})
