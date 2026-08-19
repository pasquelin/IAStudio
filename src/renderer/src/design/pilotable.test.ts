import { describe, expect, it } from 'vitest'

/**
 * Every control of the design system, read as text — what is under test is the attribute each one
 * writes, not what it renders.
 */
const FIELDS: Record<string, string> = import.meta.glob('./*Field.tsx', {
  query: '?raw',
  import: 'default',
  eager: true,
})

/** The surfaces a script steers besides the fields: the fold, and the link row. */
const SURFACES: Record<string, string> = import.meta.glob(
  ['./PropertySection.tsx', './LinkField/LinkField.tsx'],
  { query: '?raw', import: 'default', eager: true },
)

const ALL = { ...FIELDS, ...SURFACES }

/**
 * The studio is driven from outside — by the MCP over CDP, and by whatever a test reaches for.
 * That driving has to name a control, and the only names on screen are TRANSLATED: a script
 * written against « Position » stops working the moment the window is opened in English.
 *
 * `data-sc` is the name that does not move. It is derived from the code — `transform.position.x`
 * — and never from a word anyone reads.
 */
describe('a control the studio can be driven by', () => {
  it('finds the controls at all, so the rules below cannot pass on an empty glob', () => {
    expect(Object.keys(FIELDS).length).toBeGreaterThan(5)
    expect(Object.keys(SURFACES).length).toBe(2)
  })

  /**
   * Written OR handed on: a vector draws no control of its own — it stacks three `NumberField`s
   * and extends the handle with each axis — and a link row hands its own to the select inside it.
   * Demanding the attribute itself would have asked both of them to draw a second, dead one.
   */
  it('offers a handle on every family of control', () => {
    const silent = Object.entries(ALL)
      .filter(([, source]) => !source.includes('data-sc') && !/scId=\{/.test(source))
      .map(([path]) => path)

    expect(silent, `these cannot be named from a script: ${silent.join(', ')}`).toEqual([])
  })

  /**
   * The whole point, and the one thing a reviewer cannot see by reading a diff: a handle composed
   * from a label is a handle that changes with the language, which is the defect this attribute
   * exists to remove. It would also pass every test written in French.
   */
  it('never builds a handle out of a word anyone reads', () => {
    const TRANSLATED = /data-sc=\{[^}]*\bt\(/
    const guilty = Object.entries(ALL)
      .filter(([, source]) => TRANSLATED.test(source))
      .map(([path]) => path)

    expect(guilty, `these name a control by a translated word: ${guilty.join(', ')}`).toEqual([])
  })

  /**
   * `label` is the prop every one of these carries, and it holds a translated string — so reading
   * it into the handle is the same defect as calling `t` inline, one indirection further away.
   */
  it('never builds a handle out of the label it was handed either', () => {
    const FROM_LABEL = /data-sc=\{[^}]*\blabel\b/
    const guilty = Object.entries(ALL)
      .filter(([, source]) => FROM_LABEL.test(source))
      .map(([path]) => path)

    expect(guilty).toEqual([])
  })

  /**
   * Prefixed by what the thing IS, so a script can tell a section from a field without knowing
   * the tree — `section:transform` folds, `field:transform.position.x` takes a value, and
   * `link:material.normalMap` accepts a drop.
   */
  it('says what kind of thing it names, not only which one', () => {
    const KINDS = /`(section|field|link|action):\$\{/
    const unprefixed = Object.entries(ALL)
      .filter(([, source]) => source.includes('data-sc') && !KINDS.test(source))
      .map(([path]) => path)

    expect(unprefixed).toEqual([])
  })
})
