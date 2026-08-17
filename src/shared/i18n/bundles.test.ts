import { describe, expect, it } from 'vitest'
import { ACTIVITY_LEVELS, ACTIVITY_MESSAGES, ACTIVITY_TOPICS } from '../domain/activity'
import { TRACK_PROPERTIES } from '../domain/animation'
import { HOME_SECTION_IDS } from '../domain/home'
import { DISPLAY_MODES, VIEW_DIRECTIONS } from '../domain/scene'
import { TOOL_PLACEMENTS } from '../domain/tool'
import { ASSET_BADGES } from '../domain/asset'
import { FILE_DOMAINS } from '../domain/fileRole'
import { ASSISTANT_MODELS } from '../domain/assistant'
import { STT_ERROR_CODES } from '../domain/dictation'
import { breakableSpots } from './typography'
import { isRecord } from '../guards'
import { foldForSearch } from '../text'
import { NAMED_KEYS } from '../domain/shortcut'
import { COMMAND_SCOPES } from '../domain/command'
import {
  CAPABILITIES_BY_FAMILY,
  MODEL_FAMILIES,
  MODEL_PERIODS,
  MODEL_SORTS,
  PERIOD_DAYS,
  TAG_LABEL_KEY_LIST,
} from '../domain/model'
import { INGEST_STAGES } from '../domain/media'
import { JOB_STATUSES } from '../domain/job'
import { LOG_SCOPES } from '../ipc'
import { PBR_CHANNELS } from '../domain/texture'
import { WORKSPACE_IDS } from '../domain/workspace'
import { USAGE_ACTIONS, USAGE_ASSET_KINDS, USAGE_EVENT_ACTIONS } from '../domain/usage'
import { LANGUAGES, TRANSLATIONS, type Language } from './index'
import { americanVerbs, americanWords } from './spelling-fixtures'

function flatten(
  bundle: unknown,
  prefix = '',
  into = new Map<string, string>(),
): Map<string, string> {
  if (!isRecord(bundle)) return into

  for (const [name, value] of Object.entries(bundle)) {
    const key = prefix ? `${prefix}.${name}` : name
    if (isRecord(value)) flatten(value, key, into)
    else into.set(key, String(value))
  }

  return into
}

/** `{{count}}`, and every other hole a caller has to fill. */
function holes(text: string): readonly string[] {
  return [...text.matchAll(/\{\{[^}]+\}\}/g)].map(match => match[0]).sort()
}

/** Every key, nested ones included, in the order the file writes them. */
/**
 * What a block holds, with its names sorted at every depth.
 *
 * Sorted because the order is not part of what a block SAYS: the same six keys pasted back in a
 * different order are the same six keys, and a review caught this comparing raw `JSON.stringify`
 * — which would have called them different and let the copy through.
 */
function shapeOf(value: unknown): string {
  if (!isRecord(value)) return JSON.stringify(value)

  return JSON.stringify(
    Object.entries(value)
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([name, held]) => [name, shapeOf(held)]),
  )
}

/** Every nested block, by what it holds — two paths under one shape is one block written twice. */
function blocksOf(
  bundle: unknown,
  prefix = '',
  into = new Map<string, string[]>(),
): Map<string, string[]> {
  if (!isRecord(bundle)) return into

  for (const [name, value] of Object.entries(bundle)) {
    if (!isRecord(value)) continue

    const key = prefix ? `${prefix}.${name}` : name
    const shape = shapeOf(value)
    into.set(shape, [...(into.get(shape) ?? []), key])
    blocksOf(value, key, into)
  }

  return into
}

function orderOf(bundle: unknown, prefix = '', into: string[] = []): string[] {
  if (!isRecord(bundle)) return into

  for (const [name, value] of Object.entries(bundle)) {
    const key = prefix ? `${prefix}.${name}` : name
    into.push(key)
    if (isRecord(value)) orderOf(value, key, into)
  }

  return into
}

const CODES = LANGUAGES.map(language => language.code)

// Written out rather than mapped over `LANGUAGES`: the Record makes a new language a compile
// error here, which is the one place that must not silently skip it.
const BUNDLES: Record<Language, Map<string, string>> = {
  fr: flatten(TRANSLATIONS.fr),
  en: flatten(TRANSLATIONS.en),
}

const REFERENCE = BUNDLES.fr

/**
 * The words a reader would notice twice: folded the way the search box folds them, holes dropped
 * — a `{{name}}` is written by the caller, not by the label — and short ones left out, articles
 * and prepositions being shared by any two French sentences.
 */
const longWords = (text: string): string[] =>
  foldForSearch(text.replace(/{{[^}]*}}/g, ' '))
    .split(/[^\p{Letter}\p{Number}]+/u)
    .filter(word => word.length > 3)

/**
 * Named one key at a time rather than by its subtree: `usage.actionNames` also holds labels the
 * studio words itself, and exempting the branch would let the next one drift. What this split
 * costs the reader is written at `TWO_THINGS.vectorisation`.
 */
const NAMED_AS_THE_API_BILLS_IT: ReadonlySet<string> = new Set(['usage.actionNames.vectorization'])

/**
 * The three blend modes carrying `color`, spelled as `mix-blend-mode` spells them. Exempt from
 * the WORDS reading only — one exemption per reading, never one per key: written as a single set,
 * these three would also stop being read for `-ize`, and `usage.actionNames.vectorization` would
 * stop being read for `color`. Measured, both holes; the same trap `SETTLED_WORDS.except`
 * documents further down.
 *
 * Keys are flat, the section files being merged into one bundle: `blend.color`, never
 * `image.blend.color` — the guard is what said so, the prefixed spelling failed it.
 */
const NAMED_AS_CSS_BLENDS_THEM: ReadonlySet<string> = new Set([
  'blend.color',
  'blend.color-burn',
  'blend.color-dodge',
])

describe('the translation bundles', () => {
  // The typecheck only catches a bundle that MISSES a key: an extra one is still assignable.
  it.each(CODES)('says the same things in %s as every other language', code => {
    expect([...BUNDLES[code].keys()].sort()).toEqual([...REFERENCE.keys()].sort())
  })

  /**
   * Same keys in the same places, so the two files can be read side by side — which is how a
   * translation is checked, and how a missing one is seen. Two features landing at once put
   * `licences` before `usage` in one bundle and after it in the other, and forty-nine keys
   * stopped lining up.
   */
  it.each(CODES)('lists its keys in the same order as the others in %s', code => {
    expect(orderOf(TRANSLATIONS[code])).toEqual(orderOf(TRANSLATIONS.fr))
  })

  it.each(CODES)('leaves nothing blank in %s', code => {
    for (const [key, text] of BUNDLES[code]) {
      expect(text.trim(), `${key} is blank`).not.toBe('')
    }
  })

  /**
   * The same block, written twice under two names.
   *
   * `commands.sceneCounters` was a word-for-word copy of `sceneCounters`, both landed by ONE
   * commit, and nothing ever read the copy: the counters call `sceneCounters.*`, and every command
   * names its key in full — `titleKey: 'commands.projectNew.title'` — so no template could reach
   * it. Six keys per language, translated and proofread for nobody, and every guard here was green
   * the whole time: a copy is complete in both languages, blank nowhere, and ICU-valid.
   *
   * What it reads is what a block HOLDS, down to any depth and whatever order the names sit in —
   * see `shapeOf`. Nothing else repeats in either bundle, measured at every size down to a block
   * of one key, so this needs no floor and no exemption. A repeat meant on purpose will have to
   * argue for itself here.
   */
  it.each(CODES)('writes no block twice under two names in %s', code => {
    const twinned = [...blocksOf(TRANSLATIONS[code]).values()].filter(paths => paths.length > 1)

    expect(twinned).toEqual([])
  })

  /**
   * A count is text too, and a thousand is not written the same in the two languages: `4 000`
   * against `4,000`. The usage window formatted its figures through `Intl` from the start, but
   * the counts written INSIDE a sentence went out raw, and a library of four thousand assets
   * read `4000` in both.
   *
   * `{{count, number}}` hands it to i18next's own `Intl.NumberFormat`. The exception is a
   * factor rather than a tally — `4×` repeats, it does not count, and grouping it would be
   * wrong at exactly the point where the grouping would show.
   */
  it.each(CODES)('hands every count it writes to the number formatter in %s', code => {
    const factors = new Set(['texture.tilingPreviewTimes'])

    const raw = [...BUNDLES[code]]
      .filter(([key]) => !factors.has(key.replace(/_(one|other|zero|two|few|many)$/, '')))
      .filter(([, text]) => /\{\{count\}\}/.test(text))
      .map(([key]) => key)

    expect(raw).toEqual([])
  })

  /**
   * The sentences that read the same in both bundles because nobody translates them: the brand,
   * the names of file formats and of the engines a texture is exported to, two paths, a
   * copyright line, and an example someone types over.
   *
   * Anything else arriving here is an English sentence pasted into the French file — the one
   * untranslated string no other guard can see, precisely because it *is* in the bundle.
   */
  it('says something of its own in French wherever it says a sentence', () => {
    // Sentences only. A single word identical in both is usually a cognate — `Position`,
    // `Rotation`, `Saturation`, ninety-four of them — and listing those would cost far more
    // than it would ever catch.
    const wordsOf = (text: string): readonly string[] =>
      text.replace(/\{\{[^}]+\}\}/g, ' ').match(/\p{Letter}{2,}/gu) ?? []

    const untranslatedOnPurpose = new Set([
      'about.copyright',
      'accounts.fromEnvFile',
      'accounts.namePlaceholder',
      'app.name',
      'exportFormats.gltf',
      'exportFormats.usdz',
      'settings.ffmpegPath.placeholder',
      // Two engines and a format. `roblox` and `raw` are one word each, which this already skips.
      'textureExportTargets.gltf',
      'textureExportTargets.unity',
      'textureExportTargets.unreal',
    ])

    const copied = [...BUNDLES.fr]
      .filter(([key, text]) => BUNDLES.en.get(key) === text)
      .filter(([, text]) => wordsOf(text).length >= 2)
      .map(([key]) => key)
      .filter(key => !untranslatedOnPurpose.has(key))

    expect(copied).toEqual([])
  })

  /**
   * `CLAUDE.md` calls the French bundle out by name: user-facing text, with no ASCII stand-ins.
   * A straight quote is one — French wrote `’` in a hundred and twenty-three lines and `'` in
   * thirty-four, so the same word was drawn two ways depending on where it was read. English had
   * no rule at all for a while, and it landed on the side its own quotation marks had already
   * taken: fifteen values wore `“ ”` while seven of `activity.*` wrote `"{{name}}"`, against
   * French counterparts all in `« »`.
   *
   * One check for both languages, because they ran on different strengths and the weaker one let
   * real text through. Asking for a letter on each side of the apostrophe misses a plural
   * possessive closing a sentence (`the other keys'.`) and one following an interpolation
   * (`{{name}}'s`), and it never looked at the quotation mark at all. This reads the SIGN alone:
   * in a bundle, neither ASCII mark carries a meaning its typographic form does not.
   */
  it.each(CODES)('writes no ASCII quotation mark or apostrophe in %s', code => {
    for (const [key, text] of BUNDLES[code]) {
      expect(text, `${key} uses a straight apostrophe`).not.toMatch(/'/)
      expect(text, `${key} uses a straight quotation mark`).not.toMatch(/"/)
    }
  })

  /**
   * The other half of French typography, and the one that shows: `;` `:` `!` `?` and the closing
   * `»` take a NO-BREAK space before them, never an ordinary one. An ordinary space is a place
   * the line may break, so a narrow column — the activity journal is one — drops the colon or
   * the closing quote alone onto the next line.
   *
   * The opening `«` takes one AFTER it, and this read only the closing side for a while. The
   * bundle holds twenty-nine citations over twenty-three values — five settings hints cite more
   * than one — and their twenty-nine closing quotes all held the no-break space while
   * twenty-eight of the openers had an ordinary one. A citation breakable at one end and not
   * the other leaves `«` as the last thing on a line: the very shape the closing half prevents.
   *
   * A number binds the same way, to its unit and to its own thousands, and that half was missing:
   * `{{units}} UC` is the readout the studio draws most, and every pattern written here looked for
   * a DIGIT — which an interpolation is not. `breakableSpots` reads all five spots, and it lives
   * in `typography.ts` because `model-text.fr.json` is guarded against exactly the same ones.
   */
  it('binds what French does not break, in French', () => {
    const breakable = [...BUNDLES.fr].flatMap(([key, text]) =>
      breakableSpots(text).map(spot => `${key} — ${spot}`),
    )

    expect(breakable).toEqual([])
  })

  /**
   * One thing, one word — for the thing a reader has to recognise across five screens.
   *
   * The desktop's own file window was called two things in each language at once: `file manager`
   * three times against `file browser` twice, `gestionnaire de fichiers` twice against `système
   * de fichiers` three times. Nothing was wrong with either sentence on its own, which is why no
   * guard here saw it and why it took reading the five side by side.
   *
   * The settings window was the second, and the same shape: eight values called it `Préférences`
   * — one of them the home tile, beside a menu row saying `Réglages…` — so a reader was told to
   * open something the menu does not name.
   *
   * A pair enters this list on two conditions: both forms measured in the bundles, AND something
   * outside the bundles settling which one wins. The manual settles both. It says `gestionnaire
   * de fichiers` nine times over five pages and keeps `système de fichiers` for the filesystem in
   * `architecture.md`; it says `Réglages` across FOURTEEN chapters and names its own chapter
   * `14-reglages.md`. Neither word was chosen here.
   *
   * The bar is the settling, not the count. An earlier draft called the settings pair a product
   * call and left it out — on a guess, before measuring what the manual said. The draft after it
   * wrote "eight chapters" and "`Préférences` exactly once", both off: fourteen, and the second
   * true only of the capitalised form. A guard is a poor place to freeze a number nobody rechecks.
   *
   * The third pair is `picture` against `image`, and it is the one this list was widened for.
   * The English called the same thing both ways in the same window — thirty values said
   * `picture` where forty said `image`, for a French bundle that says `image` and nothing else.
   * What settles it is not the count: `Image` is the name of the space, of the asset type, of
   * the menu and of the model families, seventeen values carrying it capitalised as a proper
   * noun. Prose that reaches for a synonym to avoid repeating a word is good English and poor
   * interface — a reader recognises one word, not two.
   *
   * `except` exists for that pair alone. The picture track of a sequence is `picture` against
   * `sound`, which is what the trade calls those two tracks; `TWO_THINGS.image` already names
   * that reading. An entry with no `except` covers its whole bundle.
   *
   * `champ de vision` against `angle de vue` is the fourth, and French-only — the English says
   * `Field of view` on both surfaces. The manual glossary settles it, head-word `Angle de vue`.
   *
   * `maillage` against `maille` is the fifth, French-only again, settled by the same glossary —
   * head-word `Maille`, and the panel is `Mailles`. Its `except` is the one reading French keeps:
   * `sceneDisplay.wireframeHint` says `la densité du maillage`, the TESSELLATION, not the object.
   *
   * What this does NOT catch: a form split across two lines, a THIRD synonym nobody has written
   * yet (`explorateur de fichiers`, `file explorer`), and text in NFD. And what it catches TOO
   * much, the day a bundle says it: `préférence` in the sense of a taste — "ce n'est pas une
   * préférence", "by preference" — where demanding `réglages` would be nonsense. The prose of the
   * repo already writes it that way; no bundle does yet, and this line is what to read when one
   * does.
   *
   * Nor does it reach OUTSIDE the bundles, and that is the hole the `picture` batch fell into:
   * `docs/en/manual/` quotes labels, sometimes cut short by an ellipsis — `"Drop a picture…"` —
   * so a search for the whole value walks straight past them. Four such quotes followed that
   * batch, the fourth found by review rather than by any guard. A label renamed here is not
   * done until `grep` has read the manual for its opening words, not its whole sentence.
   *
   * Two more holes, named by review so nobody has to rediscover them. **`except` exempts the
   * whole KEY, not the one reading it was granted for**: `inspector.kind_video` is allowed
   * `Picture` for the picture track, and would keep passing if it started saying `Drop a
   * picture from the project`. And this reads VALUES only — `generation.dropPicture`,
   * `texture.noPicture` and `texture.noPictureHint` still carry the old word in their NAMES,
   * which is not screen text and not a fault, but is where the word would creep back in.
   */
  const SETTLED_WORDS: Record<
    Language,
    readonly { dropped: RegExp; kept: string; except?: readonly string[] }[]
  > = {
    fr: [
      { dropped: /système de fichiers/i, kept: 'gestionnaire de fichiers' },
      { dropped: /préférences?/i, kept: 'réglages' },
      { dropped: /champ de vision/i, kept: 'angle de vue' },
      { dropped: /maillages?/i, kept: 'maille', except: ['sceneDisplay.wireframeHint'] },
    ],
    en: [
      { dropped: /file browser/i, kept: 'file manager' },
      { dropped: /\bpreferences?\b/i, kept: 'settings' },
      {
        dropped: /\bpictures?\b/i,
        kept: 'image',
        except: ['inspector.kind_video', 'commands.sequenceUnlink.title'],
      },
    ],
  }

  it.each(CODES)('says one thing one way in %s', code => {
    const drifted = [...BUNDLES[code]].flatMap(([key, text]) =>
      SETTLED_WORDS[code]
        .filter(({ dropped, except }) => dropped.test(text) && !except?.includes(key))
        .map(({ kept }) => `${key} — say "${kept}"`),
    )

    expect(drifted).toEqual([])
  })

  /**
   * An exempted key that stopped writing the word it was exempted for is an exemption nobody
   * would think to delete — and the next reader takes it for a rule. The same reasoning as the
   * stale `TWO_THINGS` entry below, applied to a list of keys rather than a term.
   */
  it.each(CODES)('drops a key exemption once that key stops saying the word in %s', code => {
    const covering = SETTLED_WORDS[code].flatMap(({ dropped, except }) =>
      (except ?? [])
        .filter(key => {
          const text = BUNDLES[code].get(key)
          return text === undefined || !dropped.test(text)
        })
        .map(key => `${key} — no longer says what ${dropped.source} exempts it for`),
    )

    expect(covering).toEqual([])
  })

  /**
   * One French label, one English word — the pendant of `SETTLED_WORDS`, across the pair rather
   * than inside a bundle. The generator panel read `Generate` while five other keys said
   * `Generation`, and the 3D snap command read `Snapping` beside a canvas one saying `Snap`.
   * Neither sentence was wrong on its own; what was wrong was reading them one after the other.
   *
   * Text with a hole and text ending on punctuation stay out: a sentence says one thing many
   * ways on purpose, while a label is what a reader recognises from one screen to the next, and
   * one written twice is a convention whether or not anyone wrote it down.
   *
   * A word count is NOT part of that filter, and the first draft had one. Measured on these
   * bundles, a ceiling of three, four, five, eight words and no ceiling at all return the SAME
   * nineteen splits — the ceiling only ever shrank the net, to 784 terms watched instead of
   * 1223. A number that changes no verdict is a number nobody rechecks the day it starts to.
   *
   * Case and a trailing ellipsis fold away: the native menu's `Show All`, whose wording macOS
   * owns, is the same word as the settings' `Show all`. `foldForSearch` is NOT the fold to reach
   * for — it drops diacritics, so `échec` would meet `echec` and every accented exemption below
   * would quietly stop matching the term it names.
   *
   * What this does NOT catch: a label used once — nothing to be inconsistent with — a term
   * inside a sentence, and the reverse direction, one English word for two French labels. That
   * last one is usually right, English being the poorer in flexions: `Move` renders `Déplacer`
   * and `Déplacement` both, and demanding otherwise would make the English worse.
   */
  const isComparable = (text: string): boolean =>
    text.length > 1 && holes(text).length === 0 && !/[.!?:]$/.test(text)

  const asTerm = (text: string): string => text.replace(/…+$/, '').trim().toLocaleLowerCase('fr')

  /**
   * French labels that name two things — each entry naming the readings it allows, and what
   * separates them. **An entry covers the forms it lists and nothing else**: a third English
   * word appearing under an exempted term is drift again, and the test says so.
   *
   * That is not a precaution, it is the hole the first draft had. `tout afficher` read THREE
   * ways — `show everything` on the activity filter, `show all` in the settings and the native
   * menu, `fit to view` on the sequence command. The entry named two of them, and the first two
   * are the same act on the same kind of surface: a real split that the exemption swallowed
   * whole. It was caught by eye, outside this file, which is exactly what a guard is for.
   *
   * A label earns its place here by naming a difference, never by being noisy — and it leaves
   * the day one of its readings stops being written, which the second test makes happen.
   */
  const TWO_THINGS: Record<string, { reads: readonly string[]; separates: string }> = {
    annuler: { reads: ['cancel', 'undo'], separates: 'closes a dialog, and undoes an edit' },
    supprimer: { reads: ['delete', 'remove'], separates: 'destroys, and takes off a list' },
    repères: { reads: ['helpers', 'guides'], separates: "the 3D scene's, and the canvas'" },
    déplacement: {
      reads: ['move', 'displacement'],
      separates: "the tool, and a texture's displacement map",
    },
    image: {
      reads: ['image', 'picture'],
      separates: 'the asset, and the picture track of a sequence — as `Sound` is for audio',
    },
    nœud: { reads: ['node', 'knot'], separates: 'a graph node, and the torus knot shape' },
    teinte: { reads: ['tint', 'hue'], separates: 'a tint laid over, and the hue component' },
    début: { reads: ['start', 'home'], separates: 'a time, and the Home key' },
    tout: { reads: ['all', 'everything'], separates: 'a filter, and a log level' },
    recadrage: {
      reads: ['crop', 'reframe'],
      separates: 'the tool, and the Scenario action, which the API names reframe',
    },
    agrandissement: {
      reads: ['upscaling', 'upscale'],
      separates:
        'the model family, named as the other families are — `Background removal`, ' +
        '`Vectorisation` — and the billed action, named as the API names it, beside `Reframe`',
    },
    vectorisation: {
      reads: ['vectorisation', 'vectorization'],
      separates:
        'the model family and the menu command, spelled as this British bundle spells them, ' +
        'and the billed action, named as the API names it — the same split as `agrandissement`',
    },
    échec: { reads: ['failed', 'failure'], separates: 'a status value, and a log level' },
    édition: { reads: ['editing', 'edit'], separates: 'a model tag, and the native Edit menu' },
    'outils de développement': {
      reads: ['toggle developer tools', 'developer tools'],
      separates: 'the native menu, worded as Electron words it, and the setting',
    },
    couleur: {
      reads: ['colour', 'color'],
      separates: 'everywhere, and the blend modes, which carry the CSS mix-blend-mode names',
    },
    'tout afficher': {
      reads: ['show all', 'fit to view'],
      separates: 'lifting a filter, and fitting the view',
    },
  }

  const ENGLISH_FORMS = ((): Map<string, Set<string>> => {
    const forms = new Map<string, Set<string>>()

    for (const [key, source] of REFERENCE) {
      const target = BUNDLES.en.get(key)
      if (target === undefined || !isComparable(source) || !isComparable(target)) continue
      const term = asTerm(source)
      const written = forms.get(term) ?? new Set<string>()
      written.add(asTerm(target))
      forms.set(term, written)
    }

    return forms
  })()

  it('renders a repeated French label the same way in English', () => {
    const drifted = [...ENGLISH_FORMS]
      .filter(([, written]) => written.size > 1)
      .filter(([term, written]) => {
        const allowed = TWO_THINGS[term]?.reads
        return allowed === undefined || [...written].some(form => !allowed.includes(form))
      })
      .map(([term, written]) => `${term} — ${[...written].join(' / ')}`)

    expect(drifted).toEqual([])
  })

  /**
   * An exemption that stopped naming a real split is the one nobody would think to delete. It
   * names the reading that went missing rather than saying "stale": a form also leaves when its
   * key gains a `{{hole}}` or a full stop, and told apart from a split that closed, those two
   * ask for opposite fixes.
   */
  it('drops an exemption once the label stops reading both ways', () => {
    const settled = Object.entries(TWO_THINGS)
      .map(([term, allowed]) => {
        const written = ENGLISH_FORMS.get(term) ?? new Set<string>()
        return { term, missing: allowed.reads.filter(form => !written.has(form)) }
      })
      .filter(({ missing }) => missing.length > 0)
      .map(({ term, missing }) => `${term} — nothing reads ${missing.join(', ')} any more`)

    expect(settled).toEqual([])
  })

  /**
   * The English bundle is British throughout — `colour` ×26, `centre`, `licence`, `cancelled`,
   * `grey`. Of the sixteen `blend.*` names `mix-blend-mode` spells, only the three carrying
   * `color` need an exemption; the other thirteen say nothing this reads, measured. The `-ize`
   * suffix was the one thing that had drifted, and nothing in this file could see it: the guard
   * above compares a label to its OTHER readings, so a term written once anywhere is invisible
   * to it. The manual was already spelling `vectorisation` in prose while the bundle it quotes
   * said `Vectorization`.
   *
   * It reads only `BUNDLES.en`, which used to be its blind spot: the twenty chapters the Help
   * window renders from `manual.json` pass through no bundle at all. `manual.i18n.test.ts` reads
   * them now, with the same two readings — shared through `spelling-fixtures`, so a root exempted
   * for one side is exempt for both. The key-by-key exemption stays here: it names bundle paths,
   * which the manual has none of.
   *
   * The words are asked of the bundle since the manual settled `dialogue`: the two texts quote
   * each other, and a label the manual explains in British while the bundle spells it American
   * reads as two products. Four keys are exempt in all, one reading each, measured.
   */
  it('spells its English the British way', () => {
    const american = [...BUNDLES.en].flatMap(([key, text]) =>
      [
        ...(NAMED_AS_THE_API_BILLS_IT.has(key) ? [] : americanVerbs(text)),
        ...(NAMED_AS_CSS_BLENDS_THEM.has(key) ? [] : americanWords(text)),
      ].map(word => `${key} — ${word}`),
    )

    expect(american).toEqual([])
  })

  /**
   * The same reasoning as the `SETTLED_WORDS.except` guard above, applied to the two sets the
   * spelling guard reads: an exemption whose key no longer says the word — or no longer exists —
   * is one nobody would think to delete, and the next reader takes it for a rule.
   */
  it('drops a spelling exemption once its key stops needing it', () => {
    const stale = [
      ...[...NAMED_AS_THE_API_BILLS_IT].filter(
        key => americanVerbs(BUNDLES.en.get(key) ?? '').length === 0,
      ),
      ...[...NAMED_AS_CSS_BLENDS_THEM].filter(
        key => americanWords(BUNDLES.en.get(key) ?? '').length === 0,
      ),
    ]

    expect(stale).toEqual([])
  })

  /**
   * A tooltip on a button whose label is already visible EXPLAINS instead of repeating: read
   * aloud, a tooltip that says the label back is the same words twice.
   *
   * What it measures is that the tooltip adds almost NOTHING — the whole label, back, plus one
   * word at most. Not that it echoes: `Rectangle` / `Tracer un rectangle — Maj pour un carré`
   * repeats its label word for word and is the form this repository writes, because the words
   * AFTER the echo are the explanation. `Sélection rectangulaire` / `Tracer une sélection
   * rectangulaire` had nothing after it, and that is what was caught.
   *
   * The bar sits there because a stricter one is unusable: of the 213 label/tooltip pairs, 80
   * share a word — `Supprimer le calque` beside `Supprimer le calque actif — le dernier ne peut
   * pas l'être` among them — and nearly all of those explain something real. A guard on shared
   * words would report eighty labels and be turned off within the day.
   *
   * Its blind spots, measured, and they are wide:
   * - a label with no word over three letters is never read — `OK`, `Fit`, `Top`, `Pen`, `A/B`,
   *   nine such in English and four in French, and short labels are the likeliest to be echoed;
   * - French inflection hides an echo from it: `Fermer les autres onglets` beside `Ferme tous les
   *   autres onglets` compares `fermer` to `ferme` and finds two words, so the guard is weaker in
   *   the language this repository writes its labels in first;
   * - pairing is by name, `fooHint` beside `foo`, and 45 of the 158 tooltip keys escape it — 20
   *   `*Hint` whose label lives under another name, 25 spelled otherwise (`activity.filters.hint`
   *   is a real tooltip), 9 composed at runtime (`sceneViews.${view}Hint`).
   *
   * A concise tooltip can therefore be flagged where it was right — `Delete layer` beside
   * `Delete the active layer` would be. The fix then is to say the second useful thing, not to
   * exempt the key.
   */
  it.each(CODES)('explains a label in %s rather than saying it back', code => {
    const echoed = [...BUNDLES[code]]
      .filter(([key]) => key.endsWith('Hint') && BUNDLES[code].has(key.slice(0, -'Hint'.length)))
      .filter(([key, hint]) => {
        const label = new Set(longWords(BUNDLES[code].get(key.slice(0, -'Hint'.length)) ?? ''))
        const spoken = longWords(hint)

        return (
          label.size > 0 &&
          [...label].every(word => spoken.includes(word)) &&
          spoken.filter(word => !label.has(word)).length <= 1
        )
      })
      .map(([key]) => key)

    expect(echoed).toEqual([])
  })

  /**
   * A plural base names every form the language HAS, asked of `Intl` rather than assumed. French
   * carries three — `one`, `many`, `other` — and the third language is not where this breaks: it
   * is French, at a million, where `select` answers `many` and a bundle without it renders the
   * raw key. i18next falls back to the bare key for a missing `_one` and to nothing at all here.
   *
   * Asked of `Intl` because the list is the language's, not ours: Russian and Polish add `_few`,
   * Arabic six forms, and a hand-written list would be the thing that goes stale.
   */
  it.each(CODES)('names every plural form the language has in %s', code => {
    const forms = new Intl.PluralRules(code).resolvedOptions().pluralCategories
    const bases = [...BUNDLES[code].keys()]
      .filter(key => key.endsWith('_other'))
      .map(key => key.slice(0, -'_other'.length))

    for (const form of forms)
      expect(
        bases.filter(base => !BUNDLES[code].has(`${base}_${form}`)),
        `missing the ${form} form in ${code}`,
      ).toEqual([])
    expect(bases.filter(base => BUNDLES[code].has(base))).toEqual([])
  })

  // A hole dropped in translation renders as a sentence with a number missing from it.
  it.each(CODES)('keeps the same interpolations in %s', code => {
    for (const [key, text] of BUNDLES[code]) {
      expect(holes(text), `${key} interpolates differently`).toEqual(
        holes(REFERENCE.get(key) ?? ''),
      )
    }
  })
})

/**
 * What the checks above would see, on a bundle nobody would ship.
 *
 * They read real data rather than a function, so nothing else proves they still look at
 * anything: a helper returning an empty array would turn every one of them green while
 * checking nothing at all. The two `no-hardcoded-text` files carry twenty such probes between
 * them — this file carried none until one of its guards was verified by hand, once, and the
 * proof thrown away.
 */
describe('what the guards would catch', () => {
  it('sees a hole renamed from one language to the other', () => {
    expect(holes('{{count}} assets')).not.toEqual(holes('{{n}} assets'))
  })

  // The format belongs to the hole: one language grouping its thousands and the other not.
  it('sees a number formatter dropped on one side', () => {
    expect(holes('{{units, number}} CU')).not.toEqual(holes('{{units}} CU'))
  })

  it('reads the holes of a sentence in a stable order, whatever the sentence does with them', () => {
    expect(holes('{{a}} then {{b}}')).toEqual(holes('{{b}}, and {{a}} before it'))
  })

  it('sees two bundles that stopped lining up', () => {
    expect(orderOf({ a: 1, b: 2 })).not.toEqual(orderOf({ b: 2, a: 1 }))
  })

  it('walks into the nested keys rather than stopping at the first level', () => {
    expect([...flatten({ panel: { title: 'Assets' } }).keys()]).toEqual(['panel.title'])
  })
})

/**
 * Keys the interface builds at runtime — `t(`assetTypes.${type}`)` and its like. A value added
 * to one of these unions and forgotten in the bundles shows the user the key itself, and no
 * amount of typechecking sees it: the key exists only once the template has run.
 */
const DYNAMIC_KEYS: readonly string[] = [
  // `FILE_DOMAINS` and not `ASSET_TYPES`: the same six, plus the one a file has when the studio
  // has no domain to file it under — an explorer shows those too, and « other » is an answer
  // rather than a failure to classify.
  ...FILE_DOMAINS.map(domain => `assetTypes.${domain}`),
  ...ASSET_BADGES.map(badge => `assets.badge.${badge}`),
  ...MODEL_FAMILIES.map(family => `families.${family}`),
  ...MODEL_FAMILIES.flatMap(family =>
    CAPABILITIES_BY_FAMILY[family].map(capability => `capabilities.${capability}`),
  ),
  // The facet menu reads these through a table rather than through a template, so a key here is
  // already a literal. It is listed all the same: the check beside the table only proves every
  // tag HAS a key, and a key naming nothing would still read as itself on screen.
  ...TAG_LABEL_KEY_LIST,
  // Three unions the interface composed without a net. Every value is translated today; what
  // was missing is the check that says so the day a fourth is added — a value without its line
  // shows the user the key itself.
  ...TRACK_PROPERTIES.map(property => `animation.${property}`),
  ...HOME_SECTION_IDS.map(id => `home.sections.${id}`),
  ...[...new Set(TOOL_PLACEMENTS.map(placement => placement.id))].map(id => `panels.${id}`),
  // The six sides and the seven ways of drawing them. Composed on BOTH sides now — the 3D bar
  // offers them as modes, and the native View menu offers a row each — which is exactly why the
  // lists moved here: a menu is built in the main process, out of reach of the renderer's guard.
  ...VIEW_DIRECTIONS.flatMap(direction => [
    `sceneViews.${direction}`,
    `sceneViews.${direction}Hint`,
  ]),
  ...DISPLAY_MODES.flatMap(mode => [`sceneDisplay.${mode}`, `sceneDisplay.${mode}Hint`]),
  ...MODEL_PERIODS.map(period => `periods.${period}`),
  ...MODEL_SORTS.map(sort => `sorts.${sort}`),
  ...ACTIVITY_LEVELS.map(level => `activity.levels.${level}`),
  ...ACTIVITY_TOPICS.map(topic => `activity.topics.${topic}`),
  // The lines the main process writes. The window draws them with `t(entry.messageKey)`, a call
  // whose key is a variable: no AST guard resolves it, and the renderer's stops at its own glob.
  ...ACTIVITY_MESSAGES.map(name => `activity.${name}`),
  // Written by the main process into the journal, so the miss surfaces long after the failure
  // that caused it — `font.face` shipped untranslated and read as its own key on screen.
  ...LOG_SCOPES.map(scope => `activity.scope.${scope}`),
  // Shown inside a tooltip and in the shortcuts screen, where a missing one reads as the
  // English key name rather than as an obviously broken key.
  ...NAMED_KEYS.map(key => `keys.${key}`),
  // The heading over each group of the shortcuts screen. A ninth surface added to the union
  // would title its group with the key itself, and nothing else looks at this family.
  ...COMMAND_SCOPES.map(scope => `settings.scope.${scope}`),
  // The two pipelines the user watches run: a stage or a status added without its line
  // turns the progress row into a raw code at the exact moment something is happening.
  ...JOB_STATUSES.map(status => `jobs.status.${status}`),
  ...INGEST_STAGES.map(stage => `ingest.${stage}`),
  /**
   * The models the assistant may think with, named in the picker of its own modal.
   *
   * Here rather than trusted to `exhaustive.test.ts`, which proves the LIST covers the union and
   * says nothing about the bundles: a fifth model added there and forgotten here would read as
   * `gemini-4-flash` in an otherwise French list — the family of defect the usage report already
   * shipped once, with `images-generation` sitting in a French table.
   */
  ...ASSISTANT_MODELS.map(model => `assistant.models.${model}`),
  // Composed from the shared PBR union to caption a tile of the Channels panel. `panels.channels`
  // needs no line here because `t.panels[id]` is typed; this family has no such guard, so a ninth
  // channel — and the domain warns the API adds types without notice — would caption a tile with
  // its own key.
  ...PBR_CHANNELS.map(channel => `texture.channel.${channel}`),
  // The usage report showed what the API called things — `images-generation` sat in a French
  // table, and `video` beside a `Vidéo` the bundle already knew.
  ...USAGE_ACTIONS.map(action => `usage.actionNames.${action}`),
  // The journal's own union, wider: what happened, not only what was billed.
  ...USAGE_EVENT_ACTIONS.map(action => `usage.actionNames.${action}`),
  ...USAGE_ASSET_KINDS.map(kind => `usage.assetKinds.${kind}`),
  // What the microphone answered, said in the language of whoever is reading. The detail of a
  // failure never reaches the screen — it names a file path — so the code is all there is.
  ...STT_ERROR_CODES.map(code => `dictation.errors.${code}`),
]

/**
 * i18next appends a plural category to the key it looks up, so a caller writing `pushed` reads a
 * bundle holding `pushed_one` and `pushed_other`. Until the journal's keys were listed here, every
 * dynamic key happened to be singular and the exact lookup was enough.
 *
 * `_other` and nothing else: CLDR gives it to every language, so a key carrying only `_one` is
 * one a plural draws as itself — which is the defect this file exists to catch, not to excuse.
 */
function named(code: Language, key: string): boolean {
  const written = (form: string): boolean =>
    (BUNDLES[code].get(`${key}${form}`)?.trim() ?? '') !== ''
  return written('') || written('_other')
}

describe('the keys the interface composes', () => {
  it.each(CODES)('names every value of every listed union in %s', code => {
    for (const key of DYNAMIC_KEYS) {
      expect(named(code, key), `${key} is missing`).toBe(true)
    }
  })

  it('takes a key the bundle only holds in plural form', () => {
    expect(named('fr', 'activity.pushed')).toBe(true)
    expect(named('fr', 'activity.thereIsNoSuchKey')).toBe(false)
  })
})

/**
 * Every `activity.scope.*` line is written at `level: 'error'` — `reportFailure` hard-codes it and
 * is the only caller — and it reaches the reader as a toast before it is a journal row. So the
 * sentence has one job: say that something failed.
 *
 * `scene.render` said `Rendu vidéo` / `Video render` for a year. A neutral noun phrase, the only
 * one of the twenty-nine, announcing nothing at the exact moment a render had just died. The
 * guard above it saw nothing: `DYNAMIC_KEYS` asks that the key EXISTS and is not blank, never
 * what it says.
 *
 * The wordings are listed rather than pattern-matched, because no cheap test tells a failure
 * sentence from a title. Two alternatives were measured and dropped: a value colliding with an
 * action label catches nothing (`animation.render` reads `Rendre en vidéo`, no collision at all),
 * and a minimum word count is arbitrary. Listing them costs one line the day a new phrasing is
 * written — the same upkeep `DYNAMIC_KEYS` already asks for, and an added line is a line a
 * reviewer reads.
 *
 * What this does NOT catch, and it is the important half: whether the sentence is TRUE.
 * `assets.open` used to say `Cet asset n'a nulle part où aller` and passed here, while covering
 * one of the six causes that raised it — two of which were not failures to open at all. It took
 * splitting the scope to fix, and this guard was green throughout. Announcing a failure and
 * describing the right one are two different jobs; only the first is machine work.
 *
 * Nor does the second test catch a wording made too WIDE — `/./` would pass both tests and empty
 * the guard in one line. It rules out dead entries, not dilution: "can only shrink" is about the
 * list growing into a catalogue, and says nothing about a regex that stopped being specific.
 *
 * And the list is a GRAMMAR, which is the price paid here: `Impossible de…`, `Échec de…` and
 * `Failed to…` are all correct French and English, and none of them can be pre-authorised —
 * the second test drops any wording no line uses yet. A new phrasing is a line added under a
 * reviewer's eyes, deliberately, rather than a sentence that quietly announces nothing.
 */
const FAILURE_WORDINGS: Record<Language, readonly RegExp[]> = {
  fr: [/a échoué/, /n’a pas pu/, /n’ont pas pu/, /a perdu/, /était illisible/],
  // Not `/ failed\b/`: the leading space and the case made `Failed to open…` a false red, which
  // is how English states a failure most often. Same eight lines matched either way.
  en: [/\bfailed\b/i, /could not/, /lost one of/],
}

describe('the failures the journal reports', () => {
  it.each(CODES)('says that something failed, in every scope line, in %s', code => {
    const silent = LOG_SCOPES.filter(scope => {
      const text = BUNDLES[code].get(`activity.scope.${scope}`) ?? ''
      return !FAILURE_WORDINGS[code].some(wording => wording.test(text))
    })

    expect(silent).toEqual([])
  })

  // A wording that stopped matching any line is one nobody would think to delete, and the list
  // would drift into a catalogue of everything ever written. It can only shrink on its own.
  it.each(CODES)('drops a wording once no scope line uses it in %s', code => {
    const idle = FAILURE_WORDINGS[code]
      .filter(
        wording =>
          !LOG_SCOPES.some(scope =>
            wording.test(BUNDLES[code].get(`activity.scope.${scope}`) ?? ''),
          ),
      )
      .map(wording => wording.source)

    expect(idle).toEqual([])
  })
})

/**
 * Tag and Capability are two menus of the same bar, filtering on two different things — one the
 * API matches as a tag, the other the registry applies. A `<select>` shows the chosen OPTION once
 * it closes, never the facet it belongs to (`CollectionBar.tsx` says so where it draws one), so
 * two menus wearing the same words leave a picked filter unreadable.
 *
 * The first translation of the tags walked straight into it: `Text to Image` became "Texte vers
 * image", which is what `capabilities.txt2img` had said all along. Until then the tags were in
 * English, and that — not any design — was the only thing telling the two menus apart.
 */
/**
 * The one gesture that silenced the whole arrangement, found by review: setting a translatable
 * tag to `null` left sixty-one tests green and abandoned its `modelTags.*` line in both bundles,
 * read by nobody. The table's guard only asks that every tag HAS an answer — `null` is one.
 *
 * So the orphan is what gets forbidden. A tag turned silent now fails here, at the line it left
 * behind, which is also the check that catches a key renamed on one side only.
 */
describe('the tag names the bundles carry', () => {
  it.each(CODES)('are all claimed by the table, in %s', code => {
    const orphans = [...BUNDLES[code].keys()]
      .filter(key => key.startsWith('modelTags.'))
      .filter(key => !TAG_LABEL_KEY_LIST.includes(key))

    expect(orphans).toEqual([])
  })
})

describe('two facet menus of the same bar', () => {
  it.each(CODES)('never puts the same words in both, in %s', code => {
    const capabilities = new Set(
      MODEL_FAMILIES.flatMap(family =>
        CAPABILITIES_BY_FAMILY[family].map(capability =>
          BUNDLES[code].get(`capabilities.${capability}`),
        ),
      ),
    )
    const collisions = TAG_LABEL_KEY_LIST.filter(key => capabilities.has(BUNDLES[code].get(key)))

    expect(collisions).toEqual([])
  })
})

describe('the symbol of a creative unit', () => {
  /**
   * It never stands alone in a bundle. `usage.units` did — it held `UC` and `CU`, and four sites
   * glued it to a number with a space written in the component, which left neither the order of
   * the two halves nor what separates them to a translator. A symbol a caller has to assemble is
   * an invitation to assemble it differently each time.
   *
   * Unlike the byte units next door (`units.kibibyte`), which a caller passes to `formatBytes`
   * rather than concatenates: there the composing happens in one place, and that place is tested.
   */
  it.each(LANGUAGES.map(language => language.code))('never stands alone in %s', code => {
    const alone = [...BUNDLES[code]].filter(([, value]) => /^(UC|CU)$/.test(value.trim()))

    expect(alone.map(([key]) => key)).toEqual([])
  })

  // And the sentence that carries it holds its number, so the two arrive together or not at all.
  it.each(LANGUAGES.map(language => language.code))('travels with its number in %s', code => {
    const carrying = [...BUNDLES[code]].filter(([, value]) => /\b(UC|CU)\b/.test(value))

    expect(carrying.length).toBeGreaterThan(0)
    for (const [key, value] of carrying) expect(value, key).toContain('{{units}}')
  })
})

/**
 * Hours rather than days, so every span below is a whole number: a day counted as `1 / 24` of
 * anything multiplies back to `0.9999…`, and the comparison would turn on floating point.
 *
 * A month is the thirty-day month `PERIOD_DAYS` counts, not a calendar one. That IS a second
 * place to be right, and it is the price of letting a label say `3 months` at all: a span that
 * stops being a multiple of thirty days can no longer be named in months here, and what this
 * asks for then is a label written in days — not a wider table.
 */
const UNIT_HOURS: Record<string, number> = {
  h: 1,
  heures: 1,
  hour: 1,
  hours: 1,
  jour: 24,
  jours: 24,
  day: 24,
  days: 24,
  mois: 720,
  month: 720,
  months: 720,
}

/**
 * How long a label says the span is, in hours — `null` when a figure it holds names no unit this
 * knows, which is unreadable rather than wrong and is reported as its own thing.
 *
 * EVERY figure counts, each taking the first unit word after it, and the total is their sum: a
 * label that adds two pieces together — `3 months and 5 days` — has to add up to the same span.
 * The unit is not required to sit against its figure, because French slips an adjective between
 * the two: `7 derniers jours`.
 *
 * A figure meaning something other than a duration would be counted as one, and none does today.
 * Telling the two apart would mean reading intent out of prose, which is not a thing a guard can
 * do — so it says it cannot read the label rather than pretending to have measured it.
 */
function statedHours(code: Language, period: string): number | null {
  const words = (BUNDLES[code].get(`periods.${period}`) ?? '').toLowerCase().match(/\d+|\p{L}+/gu)
  let counted = 0
  let figure: number | null = null

  for (const word of words ?? []) {
    if (/^\d+$/.test(word)) {
      if (figure !== null) return null
      figure = Number(word)
    } else if (figure !== null && UNIT_HOURS[word] !== undefined) {
      counted += figure * UNIT_HOURS[word]
      figure = null
    }
  }

  return figure === null && counted > 0 ? counted : null
}

describe('how far back a listing reaches', () => {
  /**
   * Every span is ROLLING — `now` minus so many days, `PERIOD_DAYS` applied against the main
   * process's own clock — so a label states the LENGTH the query uses, in whatever unit reads
   * best. English read `Last quarter` beside `Last 30 days`, and a quarter is a piece of the
   * calendar: ninety rolling days announced themselves as the quarter that ended, which is a
   * different set of models and no way to tell from the menu.
   *
   * Read against `PERIOD_DAYS` rather than between the bundles: two translations agreeing with
   * each other and both wrong is the failure a comparison between them cannot see, and it is
   * the likelier one — a span is edited in the table, not in one language.
   *
   * `unreadable` is kept apart from `wrong` on purpose. A locale arriving with its own words for
   * hours and days lands in the first, and what it asks for is a line in `UNIT_HOURS` — reported
   * as a wrong length, it would read as an accusation against a translation that is correct.
   *
   * It carries the label rather than the key alone, because it holds two failures whose remedies
   * are opposite: a figure whose unit is missing from the table, and a label naming no length at
   * all. The words themselves are what tells the two apart, so the report shows them.
   */
  it.each(CODES)('says how long the span the query uses is, in %s', code => {
    const spans = MODEL_PERIODS.map(period => ({
      period,
      label: BUNDLES[code].get(`periods.${period}`) ?? '',
      stated: statedHours(code, period),
      queried: PERIOD_DAYS[period] * 24,
    }))

    const unreadable = spans
      .filter(span => span.stated === null)
      .map(({ period, label }) => ({ period, label }))
    const wrong = spans.filter(span => span.stated !== null && span.stated !== span.queried)

    expect({ unreadable, wrong }).toEqual({ unreadable: [], wrong: [] })
  })
})

/**
 * A space named in the middle of a sentence — `l'espace Ciels`, `the Skies space`. French puts
 * the name after the word and English before it, which is why this reads as two alternatives
 * rather than one shape.
 *
 * The capital is what carries the whole distinction, and it is why this is not case-insensitive:
 * `l'espace de travail` is ordinary French, and a rule that read `de` as a claimed name would
 * fail on the words the bar itself uses. The price is that `l'espace ciels`, in lower case,
 * walks past — a wrong name written as a common noun reads as prose, and prose is not a claim.
 */
const NAMED_SPACE =
  /l['’]espace\s+(\p{Lu}[\p{L}\d]*)|\bthe\s+(\p{Lu}[\p{L}\d]*)\s+(?:space|workspace)\b/gu

/**
 * Names that follow this shape without meaning a workspace — a colour space, `the Lab space`.
 * Empty today, and measured so: the pattern matches nothing in either bundle but the sentence
 * this batch fixed.
 *
 * It exists so the day a colour space is written that way has an answer other than widening the
 * pattern until it says nothing — a guard that refuses something true is a guard its next reader
 * disarms.
 */
const NOT_A_WORKSPACE: ReadonlySet<string> = new Set<string>()

describe('a space a sentence points at', () => {
  /**
   * `intents.skyboxSourceHint` sent the reader to `l'espace Ciels` — `the Skies space` — and no
   * space has ever been called that: the bar reads `Skyboxes` in both languages, and the name was
   * invented in the very commit that wrote the sentence. A reader following the hint looked for
   * something that is not on their screen.
   *
   * **This reads ONE phrasing, the one that claims a name**, and the test is named for that
   * rather than for the rule a reader might hope it holds. A sentence naming the same surface
   * some other way — `the montage`, `the audio editor` — says nothing this can check. Two of the
   * five siblings of that hint do exactly that, and stay unchecked here.
   */
  it.each(CODES)('never claims a space name the bar does not carry, in %s', code => {
    const named = new Set(WORKSPACE_IDS.map(id => BUNDLES[code].get(`workspaces.${id}`)))
    const invented = [...BUNDLES[code]].flatMap(([key, value]) =>
      [...value.matchAll(NAMED_SPACE)]
        // One alternative matches, the other stays undefined — `flatMap` drops it.
        .flatMap(match => match[1] ?? match[2] ?? [])
        .filter(claimed => !named.has(claimed) && !NOT_A_WORKSPACE.has(claimed))
        .map(claimed => ({ key, claimed })),
    )

    expect(invented).toEqual([])
  })
})
