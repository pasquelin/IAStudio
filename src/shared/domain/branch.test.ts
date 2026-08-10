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

  /** A list value writes a CEL list — what `in` and the multi-value comparisons read. */
  it('writes a list where the value is one', () => {
    expect(conditionToCel({ operator: 'equals', value: ['a', "d'or"] }, 'f')).toBe(
      "trim(f) == ['a', 'd''or']",
    )
  })
})

describe('a field the inspector emptied', () => {
  /**
   * The inspector's "no field" option writes `''`, not `undefined` (`IfElseFields.tsx`). The
   * converter answers `'false'` for a falsy field and then drops it; testing only for `undefined`
   * compiled `trim() == 'a'`, which the evaluator throws on — the branch went red and blocked
   * everything downstream, on a graph Scenario runs without blinking.
   */
  it('drops a condition whose field was emptied, as the converter drops it', () => {
    expect(
      blockToCel({ logic: 'and', conditions: [{ field: '', operator: 'equals' }] }, f => f),
    ).toBe('')
  })

  it('keeps the readable conditions of a block one emptied field sits in', () => {
    const block: GraphConditionBlock = {
      logic: 'or',
      conditions: [
        { field: '', operator: 'equals', value: 'a' },
        { field: 'text1', operator: 'isEmpty' },
      ],
    }

    expect(blockToCel(block, f => f)).toBe(
      'text1 == null || size(text1) == 0 || (type(text1) != list && trim(text1) == "")',
    )
  })
})

describe('what the converter refuses outright', () => {
  /**
   * `blockToCel` is exported from `shared/` and takes a `GraphCondition` — a caller that did not
   * come through `conditionBlocksOf`, which is the only thing that folds an unknown operator back
   * to `equals`, would otherwise write `undefined && …` into the CEL sent to the thread.
   */
  it('answers false for an operator it does not know', () => {
    const block: GraphConditionBlock = {
      logic: 'and',
      // Through JSON, as a document read off a file reaches it: `parseGraph` validates the node
      // and never its `data`.
      conditions: JSON.parse('[{"field":"text1","operator":"soundsLike","value":"a"}]'),
    }

    expect(blockToCel(block, f => f)).toBe('')
  })

  it('reads a contains with no value as a match on nothing, as the converter does', () => {
    expect(conditionToCel({ operator: 'contains' }, 'f')).toBe("f.matches('.*.*')")
    expect(conditionToCel({ operator: 'notContains' }, 'f')).toBe("!f.matches('.*.*')")
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

  it('joins with && where the block says and', () => {
    const block: GraphConditionBlock = {
      logic: 'and',
      conditions: [
        { field: 'text1', operator: 'isNotEmpty' },
        { field: 'text1', operator: 'equals', value: 'a knight' },
      ],
    }

    expect(blockToCel(block, f => f)).toContain(' && ')
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
