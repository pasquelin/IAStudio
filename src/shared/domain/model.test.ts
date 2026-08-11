import { describe, expect, it } from 'vitest'
import {
  ALL_FAMILIES,
  FAMILY_TAGS,
  MODEL_FAMILIES,
  scopeOf,
  TAGS_BY_FAMILY,
  TAG_LABEL_KEYS,
  tagOfFamily,
  UNTRANSLATED_TAGS,
} from './model'

const OFFERED_TAGS = [...new Set(MODEL_FAMILIES.flatMap(family => TAGS_BY_FAMILY[family]))]

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

/**
 * The facet menu showed these as the publishers wrote them, so a French studio read `Text to
 * Image` in a menu that was French everywhere else. Naming them is what fixed it; these keep the
 * naming honest, because nothing else can: the value doubles as its own fallback, so a tag
 * forgotten here degrades silently back into English rather than failing.
 */
describe('the tags a facet menu offers', () => {
  it('either names every one of them or says it leaves it alone', () => {
    const unaccounted = OFFERED_TAGS.filter(
      tag => TAG_LABEL_KEYS[tag] === undefined && !UNTRANSLATED_TAGS.includes(tag),
    )

    expect(unaccounted).toEqual([])
  })

  it('never both names a tag and leaves it alone', () => {
    expect(UNTRANSLATED_TAGS.filter(tag => TAG_LABEL_KEYS[tag] !== undefined)).toEqual([])
  })

  // A key for a tag no menu offers is a translation nobody reads, and a bundle entry nobody
  // removes: both lists are answers about the table above, so neither outlives it.
  it('names no tag it does not offer, and leaves alone none it does not offer', () => {
    expect(Object.keys(TAG_LABEL_KEYS).filter(tag => !OFFERED_TAGS.includes(tag))).toEqual([])
    expect(UNTRANSLATED_TAGS.filter(tag => !OFFERED_TAGS.includes(tag))).toEqual([])
  })

  it('gives each tag a key of its own', () => {
    const keys = Object.values(TAG_LABEL_KEYS)

    expect(new Set(keys).size).toBe(keys.length)
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
