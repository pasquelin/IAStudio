import { describe, expect, it } from 'vitest'
import { MOST_LOADED } from '@shared/domain/assistant'
import { parseActionResult, parseThought } from './validation'

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

/**
 * 🛑 The manuals a chain has open are the one thing the WINDOW names, and a field the schema does
 * not declare is stripped in silence: the briefing would then reopen the same fields every round,
 * at a billed round trip each, with `pnpm typecheck` green throughout.
 */
describe('what a window says it already has open', () => {
  const thought = (loaded: readonly string[]): unknown => ({ utterance: 'hello', loaded })

  it('carries the names through, in the order the chain opened them', () => {
    expect(parseThought(thought(['git.checkout', 'jobs.list'])).loaded).toEqual([
      'git.checkout',
      'jobs.list',
    ])
  })

  /** A stale name costs one manual; refusing the thought over it would cost the whole turn. */
  it('drops a name the registry does not declare', () => {
    expect(parseThought(thought(['git.checkout', 'nawak.truc'])).loaded).toEqual(['git.checkout'])
  })

  // The other half of the bound: the briefing prints a block per name, so an unbounded list is a
  // briefing a renderer can grow without limit.
  it('refuses more manuals than a briefing may carry', () => {
    expect(() => parseThought(thought(Array(MOST_LOADED + 1).fill('jobs.list')))).toThrow()
  })

  it('says none where a caller named none', () => {
    expect(parseThought({ utterance: 'hello' }).loaded).toEqual([])
  })
})
