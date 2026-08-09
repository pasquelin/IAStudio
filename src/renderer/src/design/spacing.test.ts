import { describe, expect, it } from 'vitest'

/**
 * The studio spaces its controls by two, never by one. At `gap-1` a row reads as a single
 * run-on string instead of as the several things it holds — a label, a track and a number stop
 * looking like three.
 *
 * `gap-1.5` is deliberately left alone: it is already looser than one, and the half-step is what
 * a few dense rows are built on. Only the bare `gap-1` is the mistake.
 */
const BARE_GAP_ONE = /\bgap(-[xy])?-1(?![\d.])/

/**
 * Read through Vite rather than `node:fs`: this project has no Node types, and the check has to
 * live beside the style it guards rather than in the main process for want of a reader.
 */
const SOURCES: Record<string, string> = import.meta.glob('../**/*.{ts,tsx}', {
  query: '?raw',
  import: 'default',
  eager: true,
})

const OF_INTEREST = Object.entries(SOURCES).filter(([path]) => !/\.(test|bench)\.tsx?$/.test(path))

describe('the spacing of the studio', () => {
  it('finds the sources at all, so the rule below cannot pass on an empty list', () => {
    expect(OF_INTEREST.length).toBeGreaterThan(100)
  })

  it('never spaces a row by one', () => {
    const offenders = OF_INTEREST.filter(([, source]) => BARE_GAP_ONE.test(source)).map(
      ([path]) => path,
    )

    expect(offenders).toEqual([])
  })
})
