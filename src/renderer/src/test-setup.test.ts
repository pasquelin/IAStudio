import { getConfig } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import config from '../../../vitest.config.ts?raw'

/**
 * Neither bound is ours, and that is the whole design of this file.
 *
 * Importing `./test-setup` for its constant would run the `configure()` at its module scope, so
 * the case would trigger what it claims to observe — and comparing the live value to the constant
 * that just wrote it compares a number to itself. Both mutations this guard exists for survived
 * that version: unhooking `setupFiles`, and putting the patience back to the library's default.
 *
 * So the case reads what the LIBRARY does when nobody configures it, and what the RUNNER allows a
 * case. Our own number appears nowhere here; it is bracketed, not repeated.
 */
const LIBRARY_DEFAULT_MS = 1000

/**
 * What the runner allows a case, read off the config rather than repeated. Comments are stripped
 * first: that config explains its own timeout in prose, so a sentence quoting a duration would be
 * read as one.
 */
const CASE_MS = Number(
  config
    .split('\n')
    .filter(line => !line.trim().startsWith('//'))
    .join('\n')
    .match(/const TEST_TIMEOUT = ([\d_]+)/)?.[1]
    ?.replace(/_/g, ''),
)

describe('the renderer test setup', () => {
  /**
   * Which is also the proof that the setup is wired at all: `setupFiles` emptied, the library
   * answers its own default and this case is the one that says so.
   */
  it('waits longer than Testing Library would for an awaited query', () => {
    expect(getConfig().asyncUtilTimeout).toBeGreaterThan(LIBRARY_DEFAULT_MS)
  })

  /**
   * The relation, not the number: an expiry has to be reported as an expiry. A wait outliving
   * its case turns "this query never resolved" into a case killed at the runner's ceiling, which
   * names nothing. `ToolWindow.test.tsx` is the case that must state its own budget for exactly
   * this reason — it waits ten seconds, so it raises its ceiling to twenty.
   */
  it('expires before the runner gives up on the case', () => {
    expect(CASE_MS).toBeGreaterThan(0)
    expect(getConfig().asyncUtilTimeout).toBeLessThan(CASE_MS)
  })
})
