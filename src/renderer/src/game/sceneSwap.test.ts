import { describe, expect, it } from 'vitest'
import { createSceneSwap } from './sceneSwap'

describe('what a running game asks about its scenes', () => {
  /** Two scripts asking on the same step would otherwise load one and then the other at once. */
  it('keeps the FIRST request of a step and hands it over once', () => {
    const swap = createSceneSwap()

    swap.port.load('World01', 0.5)
    swap.port.load('World02', 1)

    expect(swap.pending()).toEqual({ scene: 'World01', fade: 0.5 })
    swap.settled()
    expect(swap.pending()).toBeNull()
  })

  /** A fade a script spelled as a word, or as a negative: neither is a length of time. */
  it('takes no fade from a number that is not one', () => {
    const swap = createSceneSwap()

    swap.port.load('World01', Number.NaN)

    expect(swap.pending()).toEqual({ scene: 'World01', fade: 0 })
  })

  /** 🛑 What the store is FOR: it outlives the world that wrote it. */
  it('gives back what a former scene put aside', () => {
    const swap = createSceneSwap()

    swap.port.keep('coins', 12)
    swap.port.keep('name', 'Alba')

    expect(swap.port.kept()).toEqual({ coins: 12, name: 'Alba' })
  })
})
