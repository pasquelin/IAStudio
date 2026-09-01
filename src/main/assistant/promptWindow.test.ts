import { describe, expect, it } from 'vitest'
import { promptWindow } from './promptWindow'

const turn = (chars: number): string => 'x'.repeat(chars)

describe('promptWindow', () => {
  it('keeps every turn when the window has room for them', () => {
    const window = promptWindow(turn(300), ['one', 'two', 'three'], 8192)

    expect(window).toEqual({ history: ['one', 'two', 'three'], overrun: false })
  })

  /**
   * The oldest go first, which is the same rule `recentHistory` follows: a conversation is
   * understood from its end. What is new here is that the ceiling is the model's, not a count.
   */
  it('drops the oldest turns rather than the newest', () => {
    // 3072 tokens of instruction, 1024 reserved for the reply: 4096 of the window are left, and
    // the older turn asks for 5000 of them.
    const window = promptWindow(turn(9216), [turn(15_000), 'recent'], 8192)

    expect(window.history).toEqual(['recent'])
  })

  /**
   * 🛑 The defect this module exists for: a runtime overrunning its window truncates silently and
   * cuts from the HEAD, where the studio's preamble sits. Saying so is the only thing left to do.
   */
  it('says so when the instruction alone does not fit, rather than trimming to nothing quietly', () => {
    const window = promptWindow(turn(30_000), ['one'], 2048)

    expect(window).toEqual({ history: [], overrun: true })
  })
})
