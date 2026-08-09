import { describe, expect, it } from 'vitest'
import fr from './model-text.fr.json'
import { normalizeModelText, translateModelText } from './model-text'

/**
 * The words the dictionary deliberately does not hold, because the studio says them in English
 * everywhere else too. That last clause is the test: `seed` was on this list on the argument
 * that a practitioner reads it in English — but `inspector.seed` and `skybox.seed` had said
 * « Graine » since long before, so the form was the only surface refusing the word its own
 * inspector uses. The bundle decides, not the argument.
 */
const KEPT_IN_ENGLISH = [
  'guidance scale',
  'cfg scale',
  'sampler',
  'scheduler',
  'lora',
  'checkpoint',
  'prompt',
  'negative prompt',
  'clip skip',
  'denoising strength',
]

describe('the shape a model text is looked up by', () => {
  it('ignores the case the API happens to use', () => {
    expect(normalizeModelText('SETTINGS')).toBe(normalizeModelText('Settings'))
  })

  it('ignores the spacing, including the line breaks a long description carries', () => {
    expect(normalizeModelText('  Target   size\n')).toBe('target size')
  })

  it('reads a typographic dash and quote as the plain ones', () => {
    expect(normalizeModelText('2–64 photos')).toBe(normalizeModelText('2-64 photos'))
    expect(normalizeModelText('the model’s frames')).toBe(normalizeModelText("the model's frames"))
  })

  // The likeliest edit on Scenario's side, and the one that would silently un-translate a line.
  it('reads a sentence the same with or without its closing punctuation', () => {
    expect(normalizeModelText('Higher is sharper but slower.')).toBe(
      normalizeModelText('Higher is sharper but slower'),
    )
    expect(normalizeModelText('Keep the background?')).toBe(
      normalizeModelText('Keep the background'),
    )
  })
})

describe('a text the model itself wrote', () => {
  it('is said in French when the studio knows it', () => {
    expect(translateModelText('Video', 'fr')).toBe('Vidéo')
  })

  it('is found whatever case and spacing the API sent it in', () => {
    expect(translateModelText('  VIDEO  ', 'fr')).toBe('Vidéo')
  })

  it('is handed back untouched when nobody translated it', () => {
    expect(translateModelText('Karras sigmas', 'fr')).toBe('Karras sigmas')
  })

  // The fallback has to be the English sentence, never a key: a field nobody has translated
  // stays usable, which is the same rule an unknown `kind` follows in `translateSchema`.
  it('keeps the capitals and punctuation of what it hands back', () => {
    expect(translateModelText('Max IPAdapter scale.', 'fr')).toBe('Max IPAdapter scale.')
  })

  it('is left alone in English, where the model already speaks the language', () => {
    expect(translateModelText('Video', 'en')).toBe('Video')
  })

  it('survives the empty string the API sends for a label it has none for', () => {
    expect(translateModelText('', 'fr')).toBe('')
  })
})

describe('the French of the model texts', () => {
  const entries = Object.entries(fr)

  it('is looked up by the shape every lookup normalizes to', () => {
    const unreachable = entries.filter(([source]) => normalizeModelText(source) !== source)

    expect(unreachable.map(([source]) => source)).toEqual([])
  })

  it('says something of its own, rather than repeating the English', () => {
    const idle = entries.filter(([source, french]) => normalizeModelText(french) === source)

    expect(idle.map(([source]) => source)).toEqual([])
  })

  it('types the French apostrophe rather than the ASCII one', () => {
    const straight = entries.filter(([, french]) => french.includes("'"))

    expect(straight.map(([source]) => source)).toEqual([])
  })

  it('leaves the vocabulary of the craft in English', () => {
    const translated = KEPT_IN_ENGLISH.filter(term => term in fr)

    expect(translated).toEqual([])
  })

  it('holds the words the generation panel shows on a model of every kind', () => {
    expect(entries.length).toBeGreaterThan(20)
  })
})

/**
 * The word this dictionary was written to keep in English, and no longer does. `inspector.seed`
 * and `skybox.seed` had said « Graine » all along: the generation form was the one surface
 * where the same notion answered to another name.
 */
describe('a word the studio already had its own name for', () => {
  it('says it the way the rest of the studio does', () => {
    expect(translateModelText('Seed', 'fr')).toBe('Graine')
    expect(translateModelText('seed', 'fr')).toBe('Graine')
  })

  it('leaves it alone in English, where the model already speaks the language', () => {
    expect(translateModelText('Seed', 'en')).toBe('Seed')
  })
})
