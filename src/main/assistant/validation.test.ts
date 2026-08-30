import { describe, expect, it } from 'vitest'
import { parseActionResult } from './validation'

/**
 * The boundary strips what it does not declare, and says nothing about it. What is measured here
 * is the half a client reads: a refusal it can act on rather than a bare reason.
 */
describe('what a window answers about an action asked for from outside', () => {
  it('carries the detail a client repairs from', () => {
    const result = parseActionResult({
      callId: 'c1',
      outcome: { ok: false, refusal: 'badInput', detail: 'call 2: no action "nawak.truc"' },
    })

    expect(result.outcome).toEqual({
      ok: false,
      refusal: 'badInput',
      detail: 'call 2: no action "nawak.truc"',
    })
  })

  it('carries a refusal that names nothing, unchanged', () => {
    const result = parseActionResult({ callId: 'c1', outcome: { ok: false, refusal: 'noProject' } })

    expect(result.outcome).toEqual({ ok: false, refusal: 'noProject' })
  })

  it('refuses a reason the shared list does not name', () => {
    expect(() =>
      parseActionResult({ callId: 'c1', outcome: { ok: false, refusal: 'invented' } }),
    ).toThrow()
  })
})
