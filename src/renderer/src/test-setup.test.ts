import { getConfig } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import config from '../../../vitest.config.ts?raw'
import { AWAITED_QUERY_MS } from './test-setup'

/**
 * What the runner allows a case, read off the config rather than repeated. Comments are stripped
 * first, as `coverage-thresholds.test.ts` does for the very same file: a sentence quoting a
 * duration would be read as one.
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
  it('waits longer than Testing Library would for an awaited query', () => {
    expect(getConfig().asyncUtilTimeout).toBe(AWAITED_QUERY_MS)
  })

  /**
   * The relation, not the number: an expiry has to be reported as an expiry. A wait outliving
   * its case turns "this query never resolved" into a case killed at the runner's ceiling, which
   * names nothing. `ToolWindow.test.tsx` is the case that must state its own budget for exactly
   * this reason — it waits ten seconds, so it raises its ceiling to twenty.
   */
  it('expires before the runner gives up on the case', () => {
    expect(CASE_MS).toBeGreaterThan(0)
    expect(AWAITED_QUERY_MS).toBeLessThan(CASE_MS)
  })
})
