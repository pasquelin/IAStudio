import { describe, expect, it } from 'vitest'
import {
  FAMILY_TAGS,
  MODEL_FAMILIES,
  tagLabel,
  TAGS_BY_FAMILY,
  TAG_LABEL_KEY_LIST,
  TAG_LABEL_KEYS,
  tagOfFamily,
} from './model'

const OFFERED_TAGS = [...new Set(MODEL_FAMILIES.flatMap(family => TAGS_BY_FAMILY[family]))]

describe('the tags that name a family', () => {
  /**
   * A family may claim SEVERAL tags — the skyboxes do, `SKYBOX_TAG` naming three models and
   * `skybox-upscale` the fourth — but a tag names one family and one only: `familyOf` answers
   * with the first entry it matches, so a tag written twice would file the same model under
   * whichever family happened to come first in this list.
   */
  it('names a family that exists, and never lets one tag name two', () => {
    const families = FAMILY_TAGS.map(entry => entry.family)
    const tags = FAMILY_TAGS.map(entry => entry.tag)

    expect(families.every(family => MODEL_FAMILIES.includes(family))).toBe(true)
    expect(new Set(tags).size).toBe(tags.length)
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

  /**
   * A family claiming several tags can be narrowed by NONE of them — no model carries them all,
   * so the listing would come back missing whichever the others named. The skyboxes are the
   * case: `skybox-upscale` is indexed by the API where `SKYBOX_TAG` is not, so answering it
   * here would quietly cut that space from four models to the one carrying it.
   */
  it('answers the tag of a family that has exactly one, and nothing for the others', () => {
    expect(tagOfFamily('upscale')).toBe('image-upscale')
    expect(tagOfFamily('skybox')).toBeUndefined()
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
  it('has an answer for every one of them, a name or a deliberate silence', () => {
    expect(OFFERED_TAGS.filter(tag => !(tag in TAG_LABEL_KEYS))).toEqual([])
  })

  // An entry for a tag no menu offers is a translation nobody reads and a bundle line nobody
  // removes: the record answers about the table above, so it does not outlive it.
  it('answers about no tag it does not offer', () => {
    expect(Object.keys(TAG_LABEL_KEYS).filter(tag => !OFFERED_TAGS.includes(tag))).toEqual([])
  })

  it('gives each named tag a key of its own', () => {
    expect(new Set(TAG_LABEL_KEY_LIST).size).toBe(TAG_LABEL_KEY_LIST.length)
  })

  it('shows the publisher word wherever it named nothing, never a key', () => {
    expect(tagLabel('PBR', () => 'unreachable')).toBe('PBR')
    expect(tagLabel('Multiview', key => `<${key}>`)).toBe('<modelTags.multiview>')
    // A tag the table has never heard of still has to read as something.
    expect(tagLabel('Nano Banana Pro', () => 'unreachable')).toBe('Nano Banana Pro')
  })
})
