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

/**
 * What `GET /models/{modelId}` actually answered on 11/08/2026, for one model of three families:
 * `model_openai-gpt-image-2`, `model_bytedance-seedance-2-0`, `model_tripo-v3-1-image-to-3d`.
 * Thirty-three fields, twenty-nine distinct names.
 *
 * Copied here rather than fetched: a suite that calls the API tests the network. What this holds
 * is the SHAPE the form derives a label from — `numOutputs` → `Num outputs`, the rule in
 * `schema.ts` — because that shape is the dictionary's key, and nothing else states it.
 */
const FIELD_LABELS_FROM_THE_API = [
  'Num outputs',
  // What the running app showed for that same field, and the schema tool did not: the API sends
  // a `label` of its own and `labelOf` prefers it to the derived name. Both spellings are held,
  // because which one arrives is Scenario's to decide, not ours.
  'Image Count',
  'Reference images',
  'Reference videos',
  'Reference audio',
  'Last frame image',
  'Auto size',
  'Face limit',
  'Generate audio',
  'Generate parts',
  'Geometry quality',
  'Texture quality',
  'Texture alignment',
  'Texture seed',
  'Smart low poly',
  'Quad',
  'Pbr',
  'Mask',
  'Width',
  'Height',
  'Quality',
  'Background',
  'Duration',
  'Resolution',
  'Aspect ratio',
  'Seed',
  // Audio, measured the same way on `model_elevenlabs-sound-effects-v2` and
  // `model_google-gemini-2-5-flash-tts`: a family whose fields nothing else in this list reaches.
  'Duration seconds',
  'Prompt influence',
  'Output format',
  'Voice',
  'Language',
  'Text',
  'Loop',
]

/**
 * The field names French writes exactly as English does. They cannot enter the dictionary at all
 * — a value that normalizes back to its own key fails the check below — so they are listed here
 * instead of read as a gap.
 */
const SAME_WORD_IN_FRENCH = ['Image', 'Texture', 'Orientation']

describe('the words the generation form derives from an API field name', () => {
  it('are said in French, every one of them', () => {
    const untranslated = FIELD_LABELS_FROM_THE_API.filter(
      label => translateModelText(label, 'fr') === label,
    )

    expect(untranslated).toEqual([])
  })

  it('are left alone where French writes the same word', () => {
    for (const label of SAME_WORD_IN_FRENCH) {
      expect(normalizeModelText(label) in fr, `${label} cannot be a key`).toBe(false)
      expect(translateModelText(label, 'fr')).toBe(label)
    }
  })
})

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
