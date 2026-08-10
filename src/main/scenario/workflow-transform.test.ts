import { describe, expect, it, vi } from 'vitest'
import { runTransform } from './workflow-transform'

const evaluate = (expression: string, variables: Record<string, string | readonly string[]> = {}) =>
  runTransform(expression, variables, () => {})

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

  it('drops the blanks out of a list rather than carrying empty values', () => {
    expect(evaluate("['a', '', 'b']")).toEqual(['a', 'b'])
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

  it('names the expression and the reason in the journal, never on screen', () => {
    const report = vi.fn()

    expect(runTransform('nope(', {}, report)).toBeNull()
    expect(report).toHaveBeenCalledWith(expect.stringContaining('nope('))
  })

  it('says so in the journal when the result is not text', () => {
    const report = vi.fn()

    expect(runTransform("{'k': 1}", {}, report)).toBeNull()
    expect(report).toHaveBeenCalledWith(expect.stringContaining('not text'))
  })

  /**
   * The evaluator registers `exists` against the object it is handed, so the variables must not
   * be the caller's own record: a graph's inputs are not the evaluator's to keep.
   */
  it('leaves the variables it was handed untouched', () => {
    const variables = { a: 'kept' }

    expect(evaluate("exists('a') ? a : 'none'", variables)).toEqual(['kept'])
    expect(variables).toEqual({ a: 'kept' })
  })
})
