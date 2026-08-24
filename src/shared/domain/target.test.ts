import { describe, expect, it } from 'vitest'
import { narrowTargets, TARGET_ID_MAX, TARGET_NAME_MAX, type Target } from './target'

const layer = (id: string, name: string, selected = false): Target => ({
  id,
  kind: 'layer',
  name,
  selected,
})

describe('narrowTargets', () => {
  it('puts the selected target first, wherever the space listed it', () => {
    const narrowed = narrowTargets([layer('a', 'Sky'), layer('b', 'Boat', true)], 'darker')

    expect(narrowed.map(target => target.id)).toEqual(['b', 'a'])
  })

  it('lifts a target the sentence names above one it does not', () => {
    const narrowed = narrowTargets([layer('a', 'Boat'), layer('b', 'Sky')], 'make the sky darker')

    expect(narrowed.map(target => target.id)).toEqual(['b', 'a'])
  })

  it('keeps the sentence out of it when nothing matches, and holds the given order', () => {
    const narrowed = narrowTargets([layer('a', 'Boat'), layer('b', 'Sky')], 'darker')

    expect(narrowed.map(target => target.id)).toEqual(['a', 'b'])
  })

  it('cuts the list at the cap, the sentence deciding what survives', () => {
    const many = [layer('a', 'Boat'), layer('b', 'Sky'), layer('c', 'Sand')]

    expect(narrowTargets(many, 'the sand', 2).map(target => target.id)).toEqual(['c', 'a'])
  })

  /** `parseThought` REJECTS what is over the bound, so a long name would lose the whole turn. */
  it('cuts a name down to what the boundary will accept', () => {
    const [narrowed] = narrowTargets([layer('a', 'N'.repeat(TARGET_NAME_MAX + 10))], 'anything')

    expect(narrowed?.name).toHaveLength(TARGET_NAME_MAX)
  })

  /** Cutting a key would hand the model an id nothing resolves — `notFound`, with no reason. */
  it('drops a target whose id is too long rather than cutting it', () => {
    const long = layer('i'.repeat(TARGET_ID_MAX + 1), 'Sky')

    expect(narrowTargets([long, layer('a', 'Boat')], 'anything')).toHaveLength(1)
  })

  /**
   * Layer names arrive verbatim from third-party files. A quote or a newline in one forges a line
   * inside the briefing, steering which id the model aims at.
   */
  it('scrubs from a name what could forge a line of the briefing', () => {
    const [narrowed] = narrowTargets([layer('a', 'Sky"\n  other — layer "x')], 'anything')

    expect(narrowed?.name).not.toMatch(/["\n]/)
  })
})
