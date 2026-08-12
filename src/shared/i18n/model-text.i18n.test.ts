import { describe, expect, it } from 'vitest'
import fr from './model-text.fr.json'
import { normalizeModelText, translateModelText } from './model-text'

/**
 * The words the dictionary deliberately does not hold, because the studio says them in English
 * everywhere else too. That last clause is the test, and it has emptied this list twice:
 * `seed` left it when `inspector.seed` turned out to say « Graine », then `negative prompt`
 * and `guidance scale` when the manual's glossary turned out to name them « Prompt négatif »
 * and « Guidage ». What stays is what the studio has never named in French anywhere — no
 * glossary entry, no bundle key. The usage decides, never the argument about the trade.
 */
const KEPT_IN_ENGLISH = [
  'sampler',
  'scheduler',
  'lora',
  'checkpoint',
  'prompt',
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

  /**
   * The rest of French typography, which this file had escaped entirely.
   *
   * `bundles.test.ts` holds it for `fr.json` — a NO-BREAK space before `;` `:` `!` `?` and `»`,
   * and after `«` — and this dictionary is French shown on screen just the same: it is what the
   * generation panel reads under every field a model describes. It sat outside because it is
   * excluded from the PARITY measure, being keyed on the English sentence with no English twin;
   * the exclusion quietly took the typography with it.
   *
   * What it cost: eight ordinary spaces before a double punctuation against three no-break ones —
   * the file disagreed with itself — and all three opening quotes breakable. A description is the
   * longest text the panel draws, in its narrowest column, so it is exactly where a `:` dropped
   * alone onto the next line shows.
   *
   * Written by code point, as `bundles.test.ts` does: eslint refuses either space in source, and
   * neither survives being typed into a file by hand.
   */
  it('holds its double punctuation with a no-break space', () => {
    const breakable = entries.filter(([, french]) => / [;:!?»]|« /.test(french))

    expect(breakable.map(([source]) => source)).toEqual([])
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

/**
 * The manual's glossary is a source of vocabulary in its own right, and for these two it is the
 * only one: no surface of the studio's own shows a negative prompt or a guidance scale, so no
 * bundle key names them — they reach the screen through a model's form and nowhere else.
 */
describe('the words only the glossary had named', () => {
  it('says a negative prompt the way the glossary does', () => {
    expect(translateModelText('Negative prompt', 'fr')).toBe('Prompt négatif')
  })

  // The glossary entry « Guidage » carries both senses on purpose: ControlNet, and cfg.
  it('says a guidance scale the way the glossary does', () => {
    expect(translateModelText('Guidance scale', 'fr')).toBe('Échelle de guidage')
    expect(translateModelText('CFG scale', 'fr')).toBe('Échelle de guidage')
  })

  it('leaves what the studio has never named in French', () => {
    expect(translateModelText('Sampler', 'fr')).toBe('Sampler')
    expect(translateModelText('Denoising strength', 'fr')).toBe('Denoising strength')
  })
})
