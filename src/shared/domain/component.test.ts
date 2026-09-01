import { describe, expect, it } from 'vitest'
import { withComponent, withoutComponent, type Component } from './component'

const health: Component = { type: 'Health', max: 10, current: 10 }
const movement: Component = { type: 'Movement', axis: 'y', speed: 1, distance: 2, mode: 'loop' }

describe('the components an entity carries', () => {
  it('appends one it has not got, keeping the order the others came in', () => {
    expect(withComponent([health], movement)).toEqual([health, movement])
  })

  /** One `Health` per entity: two would leave the winner to whichever system read first. */
  it('replaces the one of that type rather than doubling it, in place', () => {
    const hurt: Component = { type: 'Health', max: 10, current: 3 }

    expect(withComponent([health, movement], hurt)).toEqual([hurt, movement])
  })

  it('drops the one of a type, and leaves a list that has not got it alone', () => {
    expect(withoutComponent([health, movement], 'Health')).toEqual([movement])
    expect(withoutComponent([movement], 'Health')).toEqual([movement])
  })
})
