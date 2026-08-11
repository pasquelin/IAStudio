import { describe, expect, it } from 'vitest'
import { WRITTEN_SOURCES } from './test-harness'

/**
 * The hover of the title bar, which is the one thing `BAR_GHOST` exists to hold. Spelled out
 * anywhere else it is a third copy, and a third copy is one end of the bar lighting up in a
 * shade the others left behind.
 */
const BAR_GHOST_HOVER = 'hover:bg-elevated/60'

describe('the shared class strings', () => {
  it('finds the sources at all, so the rule below cannot pass on an empty list', () => {
    expect(WRITTEN_SOURCES.length).toBeGreaterThan(100)
  })

  it('keeps the title bar hover in one place', () => {
    const offenders = WRITTEN_SOURCES.filter(
      ([path, source]) => !path.endsWith('/styles.ts') && source.includes(BAR_GHOST_HOVER),
    ).map(([path]) => path)

    expect(offenders).toEqual([])
  })
})
