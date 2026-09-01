import { describe, expect, it } from 'vitest'
import { createSaid } from './said'

describe('what the last prompts carried', () => {
  /**
   * 🛑 The reason this exists at all: the journal keeps a line's SIZE, because it lives in a
   * database the project carries and a briefing's head names this machine's folders.
   */
  it('answers the whole of what it was given', () => {
    const said = createSaid()

    expect(said.at(said.keep('x'.repeat(90_505)))).toHaveLength(90_505)
  })

  // Bounded: a turn writes one of these per round trip, at some ninety kilobytes each.
  it('forgets the oldest rather than growing without end', () => {
    const said = createSaid()
    const first = said.keep('first')
    let last = first
    for (let at = 0; at < 40; at += 1) last = said.keep(`${at}`)

    expect(said.at(first)).toBeNull()
    expect(said.at(last)).toBe('39')
  })

  /**
   * 🛑 The key is written to `catalog.db` and outlives the process; the count restarts at 1. Kept
   * by the count alone, yesterday's line unfolded TODAY's briefing — plausible, wrong, and on the
   * one surface asked for to analyse a turn.
   */
  it('answers nothing for a key another launch wrote', () => {
    const yesterday = createSaid()
    const key = yesterday.keep('yesterday')
    const today = createSaid()
    today.keep('today')

    expect(today.at(key)).toBeNull()
  })

  it('answers nothing for a key it never gave', () => {
    expect(createSaid().at('nothing:7')).toBeNull()
  })
})
