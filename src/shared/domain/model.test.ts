import { describe, expect, it } from 'vitest'
import {
  ALL_FAMILIES,
  FAMILY_TAGS,
  MODEL_FAMILIES,
  scopeOf,
  TAGS_BY_FAMILY,
  tagOfFamily,
} from './model'

describe('the tags that name a family', () => {
  it('names a family that exists, and each one at most once', () => {
    const families = FAMILY_TAGS.map(entry => entry.family)

    expect(families.every(family => MODEL_FAMILIES.includes(family))).toBe(true)
    expect(new Set(families).size).toBe(families.length)
  })

  /**
   * `image-upscale` sat in the Image facet menu until upscalers became their own family: the
   * listing then dropped every model the facet could have matched, so the menu offered a filter
   * whose only answer was none. Under its own family it would be just as empty a promise —
   * every row already carries it.
   */
  it('offers none of them as a facet, under any family', () => {
    const offered = MODEL_FAMILIES.flatMap(family => TAGS_BY_FAMILY[family])

    expect(FAMILY_TAGS.filter(entry => offered.includes(entry.tag))).toEqual([])
  })

  it('answers the tag of a family that has one, and nothing for the others', () => {
    expect(tagOfFamily('upscale')).toBe('image-upscale')
    expect(tagOfFamily('image')).toBeUndefined()
  })
})

describe('the scope a surface browses by', () => {
  it('is the family itself wherever there is one', () => {
    for (const family of MODEL_FAMILIES) expect(scopeOf(family)).toBe(family)
  })

  it('stands in for the absence of a family, so a choice still has somewhere to be filed', () => {
    expect(scopeOf(null)).toBe(ALL_FAMILIES)
  })

  /**
   * No model carries it, and nothing must start listing it beside the ten: an eleventh entry in
   * the family menu would offer a filter whose only answer is none.
   */
  it('is not an eleventh family', () => {
    expect(MODEL_FAMILIES).not.toContain(ALL_FAMILIES)
  })
})
