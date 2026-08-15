import { describe, expect, it } from 'vitest'
import { fillHoles } from './index'

describe('fillHoles', () => {
  it('fills every occurrence of a hole, not the first', () => {
    expect(fillHoles('{{size}} × {{size}}', { size: 2048 })).toBe('2048 × 2048')
    expect(fillHoles('{{name}} — {{channel}}', { name: 'Rock', channel: 'Base colour' })).toBe(
      'Rock — Base colour',
    )
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
    expect(fillHoles('Save {{title}}?', { title: 'Price $& deal' })).toBe('Save Price $& deal?')
    expect(fillHoles('Save {{title}}?', { title: "$` $' $1" })).toBe("Save $` $' $1?")
  })

  it('leaves a hole nothing names standing, and never reads past the object', () => {
    expect(fillHoles('{{name}} — {{channel}}', { name: 'Rock' })).toBe('Rock — {{channel}}')
    // `in` would answer true here and print a function's source into the sentence.
    expect(fillHoles('{{toString}}', {})).toBe('{{toString}}')
  })

  /**
   * Not i18next: a formatted hole is the window's job, and printing a raw number where it prints
   * a grouped one would be worse than leaving the hole visible to whoever put it in a main-process
   * sentence. Every formatted hole of the bundles is in a section only the window reads.
   */
  it('leaves a hole carrying a format whole', () => {
    expect(fillHoles('{{count, number}} assets', { count: 1200 })).toBe('{{count, number}} assets')
  })
})
