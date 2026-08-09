import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

// Under `src/main` for the same reason `licences.test.ts` is: `src/shared` compiles for the
// renderer, where `node:fs` has no types, and the file this guards sits at the root.
const ROOT = join(import.meta.dirname, '..', '..')

/**
 * Comments are stripped first: this file explains the very trap it guards against, so a
 * sentence quoting a threshold would be read as one.
 */
const CONFIG = readFileSync(join(ROOT, 'vitest.config.ts'), 'utf8')
  .split('\n')
  .filter(line => !line.trim().startsWith('//'))
  .join('\n')

// All four keys vitest accepts, not just the two in use: a `lines` threshold added later would
// carry the same trap, and a guard that only knows today's keys stops guarding the day one lands.
const DECLARED = [...CONFIG.matchAll(/(statements|branches|lines|functions):\s*(-?\d+)/g)].map(
  match => ({ key: match[1], value: Number(match[2]) }),
)

describe('the coverage thresholds of the gate', () => {
  it('declares thresholds at all, so a renamed key cannot empty this check', () => {
    expect(DECLARED.length).toBeGreaterThan(20)
  })

  /**
   * Vitest reads any threshold `>= 0` as a minimum PERCENTAGE and only a negative one as a
   * budget of uncovered items. Three globs were once written `0` meaning "nothing may go
   * uncovered" and asked for "at least 0% covered" instead — a gate nothing can fail, under
   * which a diagnostics branch sat uncovered while the suite stayed green.
   *
   * There is no way to write a budget of zero: `-0 >= 0` is true in JavaScript, so `-0` falls
   * into the same branch. A glob that must be covered whole says `100`.
   */
  it('reads every threshold as either a budget or full coverage, never a bare percentage', () => {
    for (const { key, value } of DECLARED) {
      expect(
        value < 0 || value === 100,
        `${key}: ${value} is read by vitest as "at least ${value}% covered". Write a negative ` +
          `budget of uncovered items, or 100 for a glob that must be covered whole.`,
      ).toBe(true)
    }
  })
})
