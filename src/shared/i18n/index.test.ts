import { describe, expect, it } from 'vitest'
import { fillHoles } from './index'

describe('fillHoles', () => {
  it('fills every occurrence of a hole, not the first', () => {
    expect(fillHoles('{{size}} × {{size}}', { size: 2048 }, 'fr')).toBe('2048 × 2048')
    expect(
      fillHoles('{{name}} — {{channel}}', { name: 'Rock', channel: 'Base colour' }, 'fr'),
    ).toBe('Rock — Base colour')
  })

  /**
   * The defect the four hand-rolled sites carried, and the reason this one is worth a case of its
   * own: `skyboxFaceSize` is `{{size}} × {{size}}` in both bundles, and `replace` handed a literal
   * rewrites one match. Its site had been respelled with a regexp; the other three had not.
   */
  it('leaves nothing of a repeated hole behind, which a literal replace did', () => {
    expect('{{size}} × {{size}}'.replace('{{size}}', '2048')).toBe('2048 × {{size}}')
  })

  /**
   * A document title is typed by a person, and `$&` is legal in one. As the second argument of
   * `replace` it means "the whole match" and the old sites re-injected the placeholder they had
   * just consumed; a replacement FUNCTION returns its string untouched, which is what this pins.
   */
  it('writes a value holding a replacement pattern as the person typed it', () => {
    expect(fillHoles('Save {{title}}?', { title: 'Price $& deal' }, 'en')).toBe(
      'Save Price $& deal?',
    )
    expect(fillHoles('Save {{title}}?', { title: "$` $' $1" }, 'en')).toBe("Save $` $' $1?")
  })

  it('leaves a hole nothing names standing, and never reads past the object', () => {
    expect(fillHoles('{{name}} — {{channel}}', { name: 'Rock' }, 'fr')).toBe('Rock — {{channel}}')
    // `in` would answer true here and print a function's source into the sentence.
    expect(fillHoles('{{toString}}', {}, 'fr')).toBe('{{toString}}')
  })

  /**
   * This case used to assert the opposite, on the promise that every formatted hole lived in a
   * section only the window read. That promise went false without a sound — the trash dialog
   * printed `Ces {{count, number}} éléments` — so the helper learnt the one format the bundles
   * require of a count.
   */
  it('groups a count the way the window would', () => {
    expect(fillHoles('{{count, number}} assets', { count: 1200 }, 'en')).toBe('1,200 assets')
    // The French separator is a narrow no-break space, and pinning that character would make this
    // a test of the ICU data rather than of the helper. What matters is that it is NOT a comma.
    expect(fillHoles('{{count, number}} assets', { count: 1200 }, 'fr')).toMatch(/^1\D200 assets$/)
  })

  /**
   * Every other format stays whole, deliberately: guessing what `maximumFractionDigits: 1` means
   * would print a number nobody asked for, where a visible hole sends its author back here.
   */
  it('leaves a format it was not taught whole', () => {
    expect(fillHoles('{{value, number(maximumFractionDigits: 1)}} MB', { value: 2.25 }, 'fr')).toBe(
      '{{value, number(maximumFractionDigits: 1)}} MB',
    )
  })

  // A count is a number by the time it reaches here; a string is written as it stands.
  it('groups nothing a caller handed over as text', () => {
    expect(fillHoles('{{count, number}} assets', { count: '1200' }, 'fr')).toBe('1200 assets')
  })
})
