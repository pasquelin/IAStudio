import { describe, expect, it } from 'vitest'
import { blockToCel, conditionToCel } from './branch'
import type { GraphConditionBlock } from './graph'

/**
 * The operators themselves are measured against Scenario's own converter, in
 * `main/scenario/workflow-compile.test.ts`. What is left here is what that measurement cannot
 * reach: the cases where the converter answers `'false'` or nothing at all, and what the studio
 * is then supposed to do with the answer.
 */
describe('a value as CEL reads it', () => {
  /** `'01'` written back is `'1'`, so it is text — a bound typed `01` must not become one. */
  it('keeps a number that is not written as one as text', () => {
    expect(conditionToCel({ operator: 'equals', value: '01' }, 'f')).toBe("trim(f) == '01'")
    expect(conditionToCel({ operator: 'equals', value: ' 1 ' }, 'f')).toBe('trim(f) == 1')
    expect(conditionToCel({ operator: 'equals', value: '1' }, 'f')).toBe('trim(f) == 1')
  })

  it('doubles a quote rather than escaping it, which is what CEL reads', () => {
    expect(conditionToCel({ operator: 'equals', value: "d'or" }, 'f')).toBe("trim(f) == 'd''or'")
  })

  /** A pattern, not a literal: `.` would otherwise match any character in a `contains`. */
  it('escapes what a regular expression would read as syntax', () => {
    expect(conditionToCel({ operator: 'contains', value: 'a.b' }, 'f')).toBe(
      "f.matches('.*a\\.b.*')",
    )
  })

  it('answers empty text where no value was given at all', () => {
    expect(conditionToCel({ operator: 'equals' }, 'f')).toBe("trim(f) == ''")
  })
})

describe('a between', () => {
  it('reads its pair as numbers', () => {
    expect(conditionToCel({ operator: 'between', value: ['2', '7'] }, 'f')).toBe('f >= 2 && f <= 7')
  })

  /** The converter's own answer, and the reason `blockToCel` drops it rather than joining it. */
  it('refuses a pair that is not two numbers', () => {
    expect(conditionToCel({ operator: 'between', value: ['a', 'b'] }, 'f')).toBe('false')
    expect(conditionToCel({ operator: 'between', value: ['2'] }, 'f')).toBe('false')
    expect(conditionToCel({ operator: 'between', value: '2' }, 'f')).toBe('false')
  })
})

describe('a whole branch', () => {
  it('resolves a field through the name it is bound to', () => {
    const block: GraphConditionBlock = {
      logic: 'and',
      conditions: [{ field: 'text1', operator: 'isEmpty' }],
    }

    expect(blockToCel(block, field => `${field}_output`)).toContain('text1_output')
  })

  /**
   * Kept deliberately: the converter falls back to the raw name, so the case compiles against a
   * variable the run never declares. The studio has to fail the same way rather than quietly
   * decide a branch Scenario would not.
   */
  it('falls back to the raw name for a field nothing feeds', () => {
    const block: GraphConditionBlock = {
      logic: 'and',
      conditions: [{ field: 'nobody', operator: 'equals' }],
    }

    expect(blockToCel(block, () => undefined)).toBe("trim(nobody) == ''")
  })

  it('drops an unreadable condition rather than letting it decide the branch', () => {
    const block: GraphConditionBlock = {
      logic: 'or',
      conditions: [
        { field: 'text1', operator: 'between', value: ['a', 'b'] },
        { field: 'text1', operator: 'isEmpty' },
      ],
    }

    expect(blockToCel(block, field => field)).toBe(
      'text1 == null || size(text1) == 0 || (type(text1) != list && trim(text1) == "")',
    )
  })

  /** Nothing readable to test is not the same as false — the caller decides what to do with it. */
  it('answers nothing at all where no condition carries a field', () => {
    expect(blockToCel({ logic: 'and', conditions: [{ operator: 'isEmpty' }] }, f => f)).toBe('')
    expect(blockToCel({ logic: 'and', conditions: [] }, f => f)).toBe('')
  })
})
