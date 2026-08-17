import { describe, expect, it } from 'vitest'
import { delegated, type Delegation } from './delegation'
import { DEFAULT_SETTINGS } from './settings'

const armed = (partial: Partial<Delegation> = {}): Delegation => ({
  ...DEFAULT_SETTINGS.mcp,
  ...partial,
})

describe('what may run without the question on screen', () => {
  /** The studio as it was before this existed: nothing armed, everything asked about. */
  it('delegates nothing until somebody arms it', () => {
    const unarmed = DEFAULT_SETTINGS.mcp

    expect(delegated(unarmed, 'files', null, 0)).toBe(false)
    expect(delegated(unarmed, 'asset', null, 0)).toBe(false)
    expect(delegated(unarmed, 'remote', null, 0)).toBe(false)
    expect(delegated(unarmed, 'credits', 1, 0)).toBe(false)
  })

  it('lets through the levels that were armed, and only those', () => {
    const files = armed({ delegateFiles: true })

    expect(delegated(files, 'files', null, 0)).toBe(true)
    expect(delegated(files, 'asset', null, 0)).toBe(false)
    expect(delegated(files, 'remote', null, 0)).toBe(false)
  })

  it('spends up to the budget and stops there', () => {
    const budget = armed({ delegateBudget: 10 })

    expect(delegated(budget, 'credits', 4, 0)).toBe(true)
    expect(delegated(budget, 'credits', 4, 6)).toBe(true)
    // Six already spent and five more asked for is eleven, which is past ten.
    expect(delegated(budget, 'credits', 5, 6)).toBe(false)
  })

  /**
   * The rule that matters most: the API declines to price some models, and a ceiling cannot bound
   * a cost nobody knows. An unpriced spend is asked about however high the budget was set.
   */
  it('never delegates a spend the API declined to price', () => {
    expect(delegated(armed({ delegateBudget: 10_000 }), 'credits', null, 0)).toBe(false)
  })

  // Not reached — `needsConfirmation` is false for it — and answered rather than left to a default.
  it('lets an action that engages nothing through whatever is armed', () => {
    expect(delegated(DEFAULT_SETTINGS.mcp, 'none', null, 0)).toBe(true)
  })
})
