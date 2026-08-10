import { describe, expect, it } from 'vitest'
import { runTransform } from './workflow-transform'

/** The values it produced, or `null` where it refused — the reason is asserted on its own below. */
const evaluate = (
  expression: string,
  variables: Record<string, string | readonly string[]> = {},
): readonly string[] | null => {
  const verdict = runTransform(expression, variables)
  return verdict.ok ? verdict.values : null
}

const reasonOf = (expression: string): string => {
  const verdict = runTransform(expression, {})
  return verdict.ok ? '' : verdict.reason
}

describe('runTransform', () => {
  it('reads a variable under the name the converter gives the wire', () => {
    expect(evaluate("'A photo of ' + text1_output", { text1_output: 'a cat' })).toEqual([
      'A photo of a cat',
    ])
  })

  /**
   * Measured, not assumed: `evaluateCel('1 + 1')` answers `2n`. Left off the table, every
   * expression counting something would have failed while computing perfectly well.
   */
  it('carries a bigint result through as text', () => {
    expect(evaluate('1 + 1')).toEqual(['2'])
  })

  it('carries a boolean result through as text', () => {
    expect(evaluate('true')).toEqual(['true'])
  })

  it('keeps a list of strings as the several values it is', () => {
    expect(evaluate("x.split(',')", { x: 'a,b' })).toEqual(['a', 'b'])
  })

  it('reads a list variable, which is what a node producing several hands on', () => {
    expect(evaluate('items[0]', { items: ['first', 'second'] })).toEqual(['first'])
  })

  /** `asList`'s rule in the executor, for its reason: a wire carrying nothing overwrites nothing. */
  it('answers no value at all for an empty string', () => {
    expect(evaluate("''")).toEqual([])
  })

  /**
   * Kept, blanks included: dropping one changes the list's LENGTH, so `[0]` would answer `'b'`
   * here and `''` on the App the same graph publishes to.
   */
  it('carries a list over entirely, blanks included', () => {
    expect(evaluate("['a', '', 'b']")).toEqual(['a', '', 'b'])
  })

  it('refuses an expression that will not parse', () => {
    expect(evaluate('nope(')).toBeNull()
  })

  /** The one an unwired port produces: the node reads a variable no edge feeds. */
  it('refuses an expression reading a variable nothing feeds', () => {
    expect(evaluate('missing')).toBeNull()
  })

  /**
   * A map stringifies to `[object Object]`, which in a prompt is a generation paid for and thrown
   * away — so it is refused rather than carried.
   */
  it('refuses a result no port can carry', () => {
    expect(evaluate("{'k': 1}")).toBeNull()
  })

  it('refuses a list holding something that is not text', () => {
    expect(evaluate("[{'k': 1}]")).toBeNull()
  })

  /** The reason goes to the journal, the code to the node: it names the expression at fault. */
  it('names the expression and what was wrong with it', () => {
    expect(reasonOf('nope(')).toContain('nope(')
    expect(reasonOf("{'k': 1}")).toContain('not text')
  })

  /**
   * `exists` is the one function the SDK binds to the evaluation's own variables rather than to
   * the environment, so it only answers if the variables were handed over as themselves.
   */
  it('answers exists() against the variables it was given', () => {
    expect(evaluate("exists('a') ? a : 'none'", { a: 'kept' })).toEqual(['kept'])
    expect(evaluate("exists('a') ? a : 'none'")).toEqual(['none'])
  })
})
