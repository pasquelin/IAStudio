import { getConfig } from '@testing-library/react'
import { describe, expect, it } from 'vitest'

/**
 * The setup is what every renderer suite runs before its first line, and nothing else asserts it.
 *
 * This one value has a history: `develop` failed its gate twice with every test reported as
 * passing, because a two-round-trip query took 1035 ms against a default of 1000 — and the file
 * that expired carries the covered statements that keep `panels/**` inside its coverage budget.
 */
describe('the renderer test setup', () => {
  it('waits longer than Testing Library would for an awaited query', () => {
    expect(getConfig().asyncUtilTimeout).toBe(3000)
  })
})
