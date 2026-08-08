import { describe, expect, it } from 'vitest'
import { FAMILY_TAGS, MODEL_FAMILIES, TAGS_BY_FAMILY, tagOfFamily } from './model'

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
