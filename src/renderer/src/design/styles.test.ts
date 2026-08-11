import { describe, expect, it } from 'vitest'
import { TITLE_BAR_GHOST } from './styles'
import { WRITTEN_SOURCES } from './test-harness'

/**
 * Read off the skin rather than spelled out again, so a change of shade moves the rule with it.
 * Only the background: `hover:text-text` is worn all over the studio and says nothing about which
 * bar one is in, whereas the half-opaque fill belongs to this one.
 */
const OWN_HOVER = TITLE_BAR_GHOST.split(' ').filter(one => one.startsWith('hover:bg-'))

describe('the shared class strings', () => {
  it('finds the sources and the shade at all, so the rule below cannot pass on empty lists', () => {
    expect(WRITTEN_SOURCES.length).toBeGreaterThan(100)
    expect(OWN_HOVER).not.toEqual([])
  })

  it('keeps the title bar hover in one place', () => {
    const offenders = WRITTEN_SOURCES.filter(
      ([path, source]) =>
        !path.endsWith('/styles.ts') && OWN_HOVER.some(one => source.includes(one)),
    ).map(([path]) => path)

    expect(offenders).toEqual([])
  })
})
