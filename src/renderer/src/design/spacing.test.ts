import { describe, expect, it } from 'vitest'
import { WRITTEN_SOURCES } from './test-harness'

/**
 * The studio spaces its controls by two, never by one. At `gap-1` a row reads as a single
 * run-on string instead of as the several things it holds — a label, a track and a number stop
 * looking like three.
 *
 * `gap-1.5` is deliberately left alone: it is already looser than one, and the half-step is what
 * a few dense rows are built on. Only the bare `gap-1` is the mistake.
 */
const BARE_GAP_ONE = /\bgap(-[xy])?-1(?![\d.])/

describe('the spacing of the studio', () => {
  it('finds the sources at all, so the rule below cannot pass on an empty list', () => {
    expect(WRITTEN_SOURCES.length).toBeGreaterThan(100)
  })

  it('never spaces a row by one', () => {
    const offenders = WRITTEN_SOURCES.filter(([, source]) => BARE_GAP_ONE.test(source)).map(
      ([path]) => path,
    )

    expect(offenders).toEqual([])
  })
})
