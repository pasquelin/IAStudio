import { describe, expect, it } from 'vitest'
import { ACTIVITY_LEVELS, ACTIVITY_MESSAGES, ACTIVITY_TOPICS } from '../domain/activity'
import { TRACK_PROPERTIES } from '../domain/animation'
import { HOME_SECTION_IDS } from '../domain/home'
import { TOOL_PLACEMENTS } from '../domain/tool'
import { ASSET_BADGES, ASSET_TYPES } from '../domain/asset'
import { STT_ERROR_CODES } from '../domain/dictation'
import {
  CONDITION_LOGICS,
  GRAPH_COMPILE_PROBLEMS,
  GRAPH_CONDITION_OPERATORS,
  GRAPH_RUN_FAILURES,
  GRAPH_RUN_STATUSES,
  SILENT_RUN_STATUSES,
} from '../domain/graph'
import { isRecord } from '../guards'
import { NAMED_KEYS } from '../domain/shortcut'
import {
  CAPABILITIES_BY_FAMILY,
  MODEL_FAMILIES,
  MODEL_PERIODS,
  MODEL_SORTS,
  TAG_LABEL_KEY_LIST,
} from '../domain/model'
import { INGEST_STAGES } from '../domain/media'
import { JOB_STATUSES } from '../domain/job'
import { LOG_SCOPES } from '../ipc'
import { PBR_CHANNELS } from '../domain/texture'
import { USAGE_ACTIONS, USAGE_ASSET_KINDS, USAGE_EVENT_ACTIONS } from '../domain/usage'
import { LANGUAGES, TRANSLATIONS, type Language } from './index'

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
   * U+00A0 rather than the narrow U+202F: the two look alike at eleven pixels, and the wide
   * one is the space every font actually has. Named by code point because eslint refuses
   * either of them in source.
   */
  it('holds its double punctuation with a no-break space in French', () => {
    const breakable = [...BUNDLES.fr]
      .filter(([, text]) => / [;:!?»]|« /.test(text))
      .map(([key]) => key)

    expect(breakable).toEqual([])
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
  ...ASSET_TYPES.map(type => `assetTypes.${type}`),
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
  // The two pipelines the user watches run: a stage or a status added without its line
  // turns the progress row into a raw code at the exact moment something is happening.
  ...JOB_STATUSES.map(status => `jobs.status.${status}`),
  ...INGEST_STAGES.map(stage => `ingest.${stage}`),
  // A third pipeline, painted node by node on the graph canvas. Two of the eight states have no
  // line and never will: `idle` is a node saying nothing, and `failed` is never shown on its own
  // — a failure always names its reason, which is the second union below.
  ...GRAPH_RUN_STATUSES.filter(status => !SILENT_RUN_STATUSES.includes(status)).map(
    status => `graphRun.${status}`,
  ),
  ...GRAPH_RUN_FAILURES.map(failure => `graphRun.failure.${failure}`),
  // Composed the same way, one surface further down: what the editor says of a graph that would
  // not compile. A refusal added without its line reads as its own key, beside the canvas.
  ...GRAPH_COMPILE_PROBLEMS.map(problem => `graphCompile.problem.${problem}`),
  // What a branch asks, read out on the node itself and offered in the inspector. The union is
  // SCENARIO'S — its converter answers `'false'` for an operator it does not know — so a twelfth
  // one arrives from outside, and unlisted here it would caption a condition with its own key in
  // both languages.
  ...GRAPH_CONDITION_OPERATORS.map(operator => `graph.condition.${operator}`),
  ...CONDITION_LOGICS.map(logic => `graph.logic.${logic}`),
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
