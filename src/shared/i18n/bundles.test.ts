import { describe, expect, it } from 'vitest'
import { ACTIVITY_LEVELS, ACTIVITY_MESSAGES, ACTIVITY_TOPICS } from '../domain/activity'
import { TRACK_PROPERTIES } from '../domain/animation'
import {
  CAMERA_POST_MODES,
  POST_CATEGORIES,
  POST_COSTS,
  POST_EFFECT_IDS,
  POST_EFFECTS,
} from '../domain/postProcessing'
import { POST_PRESET_IDS } from '../domain/postPresets'
import { HOME_SECTION_IDS } from '../domain/home'
import {
  BACKGROUND_KINDS,
  DISPLAY_MODES,
  DISPLAY_UNITS,
  ENVIRONMENT_KINDS,
  FOG_KINDS,
  HELPER_VISIBILITIES,
  TONE_MAPPINGS,
  VIEW_DIRECTIONS,
  VIEWPORT_QUALITIES,
} from '../domain/scene'
import { CAPTURE_QUALITIES } from '../domain/sceneCapture'
import { COMPONENTS } from '../domain/componentRegistry'
import { CONTEXT_TEMPLATES } from '../domain/projectContext'
import { TOOL_PLACEMENTS } from '../domain/tool'
import { ASSET_BADGES } from '../domain/asset'
import { FILE_DOMAINS } from '../domain/fileRole'
import { GIT_CHANGES, GIT_FAILURE_KEYS, GIT_REF_KINDS, GIT_STAGES } from '../domain/git'
import { ASSISTANT_MODELS } from '../domain/assistant'
import { STT_ERROR_CODES } from '../domain/dictation'
import { CLOUD_IDS } from '../domain/aiCloud'
import { COMPATIBILITIES } from '../domain/aiMemory'
import { STANDALONE_ROLES } from '../domain/aiRole'
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
import { PBR_CHANNELS, type PbrChannel } from '../domain/material'
import { WORKSPACE_IDS } from '../domain/workspace'
import { USAGE_ACTIONS, USAGE_ASSET_KINDS, USAGE_EVENT_ACTIONS } from '../domain/usage'
import { LANGUAGES, TRANSLATIONS, type Language } from './index'
import { americanVerbs, americanWords, frenchWords } from './spelling-fixtures'
import { asRead, screenLabels, settingsTree, unquotedMenuSegments } from './menuPath-fixtures'
import modelTextFr from './model-text.fr.json'

/** Every key, nested ones included, in the order the file writes them. */
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

/** Keys writing a `FRENCH_FORMS` word in its own English sense. Empty, and measured so. */
const BORROWED_IN_ENGLISH: ReadonlySet<string> = new Set<string>()

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
    const factors = new Set(['material.tilingPreviewTimes'])

    const raw = [...BUNDLES[code]]
      .filter(([key]) => !factors.has(key.replace(/_(one|other|zero|two|few|many)$/, '')))
      .filter(([, text]) => /\{\{count\}\}/.test(text))
      .map(([key]) => key)

    expect(raw).toEqual([])
  })

  /**
   * The sentences that read the same in both bundles because nobody translates them: the brand,
   * the names of file formats and of the engines a material is exported to, two paths, a
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
      'accounts.namePlaceholder',
      'app.name',
      'exportFormats.gltf',
      'exportFormats.usdz',
      'settings.ffmpegPath.placeholder',
      // The other binary path a user may name. A filesystem path is not a sentence in any
      // language, and translating `/usr/bin/git` would be inventing a folder nobody has.
      'settings.gitBinary.placeholder',
      // Two engines and a format. `roblox` and `raw` are one word each, which this already skips.
      'materialExportTargets.gltf',
      'materialExportTargets.unity',
      'materialExportTargets.unreal',
      // A console, and consoles keep their name. `preset_psx` reads as one word to `wordsOf`.
      'postfx.preset_gameBoy',
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
   *
   * The figure half is not French — English breaks `{{units}} CU` the same way — and this read
   * `fr` alone while the English bundle held not a single no-break space. The two unit lists
   * MIRROR each other for that reason: one symbol in a list and not the other lets the bundles
   * drift apart in typography with nothing to say so.
   */
  it.each(CODES)('binds what %s does not break', code => {
    const breakable = [...BUNDLES[code]].flatMap(([key, text]) =>
      breakableSpots(text, code).map(spot => `${key} — ${spot}`),
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
   * `matériau` against `matière` is the fifth, and the first the glossary could NOT settle — it
   * had an entry for neither. The manual settles it by weight instead: `matière` 82 times over
   * thirteen chapters against `matériau` 18, and the glossary now carries the entry it lacked.
   * Its blind spot is `model-text.fr.json`, which this reading never sees: indexed on the English
   * phrase, it is not a locale, so its three `matières PBR` are held by nothing.
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
   * picture from the project`. And this reads VALUES only — `generation.dropPicture` still
   * carries the old word in its NAME, which is not screen text and not a fault, but is where the
   * word would creep back in.
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
      { dropped: /matériaux?/i, kept: 'matière' },
      /**
       * A texture IS a picture, and the studio stopped filing it apart — the kind is gone, the
       * shelf is gone, and what a picture serves is read off its channel. The word survives in
       * KEYS, which come from the API and are not screen text.
       *
       * No `except`: the two senses this would wrongly catch — the glTF vocabulary of a file
       * "with its textures beside it", and the audio one of a sound with no texture — live in
       * `docs/`, which this guard cannot reach anyway.
       */
      { dropped: /textures?/i, kept: 'image' },
      /**
       * `rigué` is English wearing a French ending, and the workspace that gave a mesh its bones
       * had already decided against it: seven of its nine sentences said `squelette`, two command
       * hints still said `rigué` and `un rig`.
       *
       * French only. English keeps `rig` beside `skeleton` because they are not the same thing
       * there — a rig is the skeleton plus what drives it — and `SETTLED_WORDS.en` would be
       * refusing a distinction the trade makes.
       */
      { dropped: /(?<!\p{L})(?:rigu[ée]e?s?|rigs?)(?!\p{L})/iu, kept: 'squelette' },
      /**
       * `plan` was a third French word for the thing on a track, written under keys NAMED
       * `unlinkedClips`. The manual glossary settles it, head-word `Clip`.
       *
       * The lookbehinds carry the senses that stay: `premier(s) plan(s)`, `second(s) plan(s)`,
       * `arrière-plan`, and `{{plan}}` — the subscription tier, a variable name and not screen
       * text. The plurals are not decoration: `premiers plans` passed the first writing.
       *
       * What the `\p{L}` lookarounds buy over `\b` is `planète`, and only it: `\b` rejects
       * `plane` and `plantage` just as well, both neighbours being ASCII. Measured, after the
       * JSDoc here claimed the opposite for a day.
       *
       * `except` is the geometric plane, and the camera shot — a take, not a stretch of media on
       * a track, and the trade word Alban settled on 18/08 for the 3D space. `bloc` against
       * `clip` meets this list's bar — 22 French values say `bloc`, all `assistant.*`, against 25
       * saying `clip`, and the glossary settles it with a head-word for `Clip`. It is left out
       * for SCOPE, not for want of evidence: 20 of the 22 sit under keys named `clip*`, which is
       * a batch of its own.
       */
      {
        dropped: /(?<!premiers? |seconds? |arrière-|\{\{)(?<!\p{L})plans?(?!\p{L})/iu,
        kept: 'clip',
        except: [
          'meshes.plane',
          'material.shapePlane',
          'inspector.shot',
          'inspector.addRailHint',
          'objects.pathHint',
          'animation.addShotHint',
          'animation.addShotNeedsCamera',
          'assistant.actions.cameraShot.description',
          'assistant.actions.cameraRail.description',
          'assistant.actions.cameraAddRail.description',
          'assistant.actions.cameraReorder.description',
          'assistant.actions.cameraTarget.description',
          // The same sense as the three above: `scene.state` hands back the shots, and says so.
          'assistant.actions.sceneState.description',
          'assistant.fields.startSeconds',
          'assistant.fields.durationSeconds',
          'assistant.fields.shotId',
        ],
      },
    ],
    en: [
      { dropped: /\bfile browsers?\b/i, kept: 'file manager' },
      /** The same word settled on the French side, for the same reason. */
      { dropped: /\btextures?\b/i, kept: 'image' },
      { dropped: /\bpreferences?\b/i, kept: 'settings' },
      {
        dropped: /\bpictures?\b/i,
        kept: 'image',
        except: ['inspector.kind_video', 'commands.sequenceUnlink.title'],
      },
      /**
       * The manual settled this one and the bundle had not followed: `activity journal` ×32 for
       * the status line, against `log` ×12 for the internal one, and `16-troubleshooting.md:642`
       * warns the reader not to confuse them. The screen said `log` for both.
       *
       * THREE surfaces, not two, and the third cost a batch to find: the usage window has a
       * `Journal` section of its own, which `03-the-window.md` names in a table — a chapter whose
       * title says nothing about usage, so a search by chapter name missed it and the batch
       * before this one wrote that no chapter described those sections.
       *
       * The exemptions left are the internal log, the one thing the manual keeps as `log` — and
       * it is now a FILE on disk, which the button under Advanced shows.
       */
      {
        dropped: /\blogs?\b/i,
        kept: 'activity journal',
        except: [
          'settings.logLevel.title',
          'settings.openDevtools.help',
          'settings.openLogFolder.title',
          'settings.openLogFolder.help',
          'settings.openLogFolder.button',
        ],
      },
      /**
       * The trade means something else by `montage` — a run of short shots, not the timeline.
       * One surface kept the French word: eleven `assistant.*` values, against `edit` in
       * thirty-three values elsewhere. It forbids `montage`; it does not require `edit`.
       */
      { dropped: /\bmontages?\b/i, kept: 'edit' },
      /**
       * One gesture, one verb: four keys say `Show in folder`, a fifth said `Reveal the technical
       * log`, and the French says `Afficher` at all five. Bundle VALUES only, which is the blind
       * spot — the manual keeps `reveals` as a plain English verb.
       */
      { dropped: /\breveals?\b/i, kept: 'show' },
      /**
       * The scene registry a model reads: eight `actions.*.description` said `node` under titles
       * that said `object`, and the French says `objet` at all 38 sites. The lookahead keeps the
       * TOOL names, the registry calling its scene tools `node.*`, so a drift inside
       * `nodeCarve` still reddens.
       * Two blind spots: the model calls `node.add` while reading a description that says
       * `object`, and the manual glossary still heads an entry `Node`, which no guard here
       * reaches. `except` is the graph node, the referent `TWO_THINGS.nœud` already separates.
       */
      {
        dropped: /\bnodes?\b(?!\.[a-z])/i,
        kept: 'object',
        except: ['inspector.node', 'inspector.expressionHint'],
      },
    ],
  }

  /**
   * One word per `SETTLED_WORDS.en` reading, for the canary below. SINGULAR on purpose: written
   * plural, `montages` slips through the very typo the canary is there to catch — `montagess?`
   * still reads it, and the canary shipped green when it was.
   */
  const ENGLISH_SAMPLES = [
    'file browser',
    'preference',
    'picture',
    'log',
    'montage',
    'reveal',
    'texture',
    'node',
  ]

  /**
   * The negative half. Each word matches its reading once the boundary is dropped, which is what
   * makes it worth asserting — a sample no reading could ever touch is green by construction.
   * `preferences?` has none: no English word carries `preference` inside a longer one.
   * `node.negate` proves the other half — what rejects it is the LOOKAHEAD, not the boundary. Which is
   * the blind spot — a reading added tomorrow without a near miss of its own stays green.
   */
  const ENGLISH_NEAR_MISSES = [
    'profile browser',
    'catalogue',
    'pictured',
    'remontage',
    'revealed',
    'textured',
    'anode',
    'node.negate',
  ]

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
   * `\b` is ASCII in JavaScript whatever the flags, so a boundary after `é` bounds nothing: the
   * first writing of the `rigué` reading also matched `intrigue`, `rigueur` and `garrigue`. It ran
   * GREEN, and only because no bundle value happened to say any of them — the manual says
   * `intrigue`. Hence the lookarounds on `\p{L}`, and hence this.
   *
   * French only, the English words being ASCII. That their readings are BOUNDED is not a property
   * of being ASCII and is kept by `ENGLISH_NEAR_MISSES` below — `/file browser/i` carried no
   * boundary and read `profile browser`. An accented English reading would belong here.
   */
  it('reads a settled French word whole, never inside a longer one', () => {
    const says = (word: string) => SETTLED_WORDS.fr.some(({ dropped }) => dropped.test(word))
    const samples = [
      'système de fichiers',
      'préférence',
      'champ de vision',
      'maillage',
      'matériau',
      'rigué',
      'riguées',
      'un rig',
      'des rigs',
      'plan',
      'plans',
      'texture',
      'textures',
    ]

    // The canary of an assertion on an empty list: a reading that stopped matching would pass it.
    expect(samples.filter(word => !says(word))).toEqual([])
    // `says` is a disjunction: without this, a typo'd reading passes on a neighbour's match.
    expect(
      SETTLED_WORDS.fr
        .filter(({ dropped }) => !samples.some(word => dropped.test(word)))
        .map(({ kept }) => kept),
    ).toEqual([])
    expect(
      [
        'intrigue',
        'intriguée',
        'rigueur',
        'garrigue',
        'planète',
        'plane',
        'plantage',
        'premier plan',
        'premiers plans',
        'second plan',
        'arrière-plan',
        'abonnement {{plan}}',
      ].filter(says),
    ).toEqual([])
  })

  /**
   * The same canary for the English readings, which had none: `drifted` runs against a bundle
   * that no longer says any of these, so a typo — `/\bmontagess?\b/` — would ship green.
   * `orphans` keeps a sample from outliving the entry it was written for, `swallowed` is the
   * negative half a reading needs to prove it reads its word whole.
   */
  it('reads every settled English word whole, none of the readings dead', () => {
    const dead = SETTLED_WORDS.en.filter(
      ({ dropped }) => !ENGLISH_SAMPLES.some(word => dropped.test(word)),
    )
    const orphans = ENGLISH_SAMPLES.filter(
      word => !SETTLED_WORDS.en.some(({ dropped }) => dropped.test(word)),
    )
    const swallowed = ENGLISH_NEAR_MISSES.filter(word =>
      SETTLED_WORDS.en.some(({ dropped }) => dropped.test(word)),
    )

    expect(dead.map(({ kept }) => kept)).toEqual([])
    expect(orphans).toEqual([])
    expect(swallowed).toEqual([])
  })

  /**
   * The same settled words, asked of the dictionary the generation form reads. It is NOT a locale
   * — indexed on the English phrase, absent from `BUNDLES` — so the two readings above never saw
   * it, and three `matériaux PBR` lived there through the whole batch that banned the word.
   *
   * French only: this file's keys are Scenario's English, which the studio neither chooses nor
   * spells. The four exemptions are one story rather than four — `maillage` is the PAVAGE and
   * stays, exactly what `sceneDisplay.wireframeHint` is exempted for. Two are the option labels a
   * 3D model offers, two are the descriptions that cite them.
   */
  const PAVAGE_NOT_THE_OBJECT: ReadonlySet<string> = new Set([
    'smart low poly',
    'quad',
    'maximum face count. adaptive if unset. with smart low poly: 1,000-20,000 (500-10,000 if ' +
      'quad is also enabled). otherwise capped at 1,500,000 (standard geometry) or 2,000,000 ' +
      '(detailed geometry). quad alone caps face limit at 150,000',
    'enable quad mesh output (fbx format). when smart low poly is off, face limit is capped at ' +
      '150,000. when smart low poly is on and face limit is unset, defaults to 10,000',
  ])

  /**
   * `texture` is not asked of this dictionary, and the reason is the same one twice over: these
   * are a MODEL's own parameters — `texture quality`, `texture seed` — where the word is the
   * trade's for what a mesh wears, and the studio neither chose the parameter nor can rename it
   * in a sentence that cites it by name.
   *
   * What the studio DID drop is the shelf: a texture is a picture in the catalogue now. The two
   * are not in conflict — a 3D model still wears textures, they are just filed as the pictures
   * they are.
   */
  const TEXTURE_ON_A_MESH: ReadonlySet<string> = new Set([
    'texture quality',
    'texture alignment',
    'texture seed',
    'enable texturing. set to false for a model without textures',
    "texture quality level. 'detailed' gives hd quality textures",
    'determines the prioritization of texture alignment in the 3d model',
    'random seed for texture generation. using the same seed will produce identical textures',
    'generate segmented 3d model parts. incompatible with texture, pbr, and quad',
    'enable pbr generation. default value is true. if this option is set to true, texture ' +
      'parameters will be ignored',
  ])

  it('says one thing one way in the dictionary of what a model wrote about itself', () => {
    const exempt = (source: string, kept: string): boolean =>
      kept === 'image' ? TEXTURE_ON_A_MESH.has(source) : PAVAGE_NOT_THE_OBJECT.has(source)

    const drifted = Object.entries(modelTextFr).flatMap(([source, french]) =>
      SETTLED_WORDS.fr
        .filter(({ dropped, kept }) => dropped.test(french) && !exempt(source, kept))
        .map(({ kept }) => `${source} — say "${kept}"`),
    )

    expect(drifted).toEqual([])
  })

  it('drops a dictionary exemption once its entry stops saying the word', () => {
    const stale = (exempted: ReadonlySet<string>, word: RegExp): string[] =>
      [...exempted].filter(source => {
        const french = Object.entries(modelTextFr).find(([key]) => key === source)?.[1]
        return french === undefined || !word.test(french)
      })

    expect(stale(PAVAGE_NOT_THE_OBJECT, /maillages?/i)).toEqual([])
    expect(stale(TEXTURE_ON_A_MESH, /textures?/i)).toEqual([])
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
   * What this does NOT catch: a label used once — nothing to be inconsistent with — and a term
   * inside a sentence. The reverse direction, one English word for two French labels, was
   * dismissed here as harmless flexion until it was measured: `TWO_WAYS` guards it now, and a
   * legitimate flexion earns an entry there rather than a flattened French.
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
  const TWO_THINGS: Split = {
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

  type Split = Record<string, { reads: readonly string[]; separates: string }>

  const formsOf = (read: Map<string, string>, against: Map<string, string>) => {
    const forms = new Map<string, Set<string>>()

    for (const [key, source] of read) {
      const target = against.get(key)
      if (target === undefined || !isComparable(source) || !isComparable(target)) continue
      const term = asTerm(source)
      forms.set(term, (forms.get(term) ?? new Set<string>()).add(asTerm(target)))
    }

    return forms
  }

  const driftedIn = (forms: Map<string, Set<string>>, exempt: Split) =>
    [...forms]
      .filter(([, written]) => written.size > 1)
      .filter(([term, written]) => {
        const allowed = exempt[term]?.reads
        return allowed === undefined || [...written].some(form => !allowed.includes(form))
      })
      .map(([term, written]) => `${term} — ${[...written].join(' / ')}`)

  const staleIn = (forms: Map<string, Set<string>>, exempt: Split) =>
    Object.entries(exempt)
      .map(([term, allowed]) => {
        const written = forms.get(term) ?? new Set<string>()
        return { term, missing: allowed.reads.filter(form => !written.has(form)) }
      })
      .filter(({ missing }) => missing.length > 0)
      .map(({ term, missing }) => `${term} — nothing reads ${missing.join(', ')} any more`)

  const ENGLISH_FORMS = formsOf(REFERENCE, BUNDLES.en)

  it('renders a repeated French label the same way in English', () => {
    expect(driftedIn(ENGLISH_FORMS, TWO_THINGS)).toEqual([])
  })

  /**
   * An exemption that stopped naming a real split is the one nobody would think to delete. It
   * names the reading that went missing rather than saying "stale": a form also leaves when its
   * key gains a `{{hole}}` or a full stop, and told apart from a split that closed, those two
   * ask for opposite fixes.
   */
  it('drops an exemption once the label stops reading both ways', () => {
    expect(staleIn(ENGLISH_FORMS, TWO_THINGS)).toEqual([])
  })

  /**
   * The mirror of `TWO_THINGS`, and the blind spot the comment above dismissed as "usually
   * right, English being the poorer in flexions". Usually is not always: of the twenty-three
   * splits these bundles hold, twenty-one are that flexion and two were drift — `Asset kind`
   * read `Type d'asset` in the usage window against four sites writing `Nature`, and `Metalness`
   * reads two ways still, settled as a product call at `NAMED_TWICE.metalness` below — where the
   * three channels this table could never see are settled with it.
   *
   * The morphological shortcut that would spare most of this table was tried and dropped:
   * skipping a pair when one form starts the other swallows `métal` / `métallicité`, the very
   * split worth seeing. A split names what separates it here, or it is drift.
   */
  const TWO_WAYS: Split = {
    added: { reads: ['ajouté le', 'ajouté'], separates: "a file's date field, and a git status" },
    back: { reads: ['de dos', 'précédent'], separates: 'a 3D view, and the explorer step back' },
    changed: { reads: ['modifiés', 'modifié'], separates: 'a count of files, and one file' },
    character: {
      reads: ['personnage', 'caractère'],
      separates: 'what a skeleton is laid on, and the half of a type panel that is not a paragraph',
    },
    crop: {
      reads: ['rogner', 'recadrage'],
      separates: 'the audio tool, which trims, and the image tool, which reframes',
    },
    delete: {
      reads: ['supprimer', 'suppr'],
      separates: 'the action, and the key cap, abbreviated as a keyboard prints it',
    },
    failed: {
      reads: ['échec', 'échouée'],
      separates: "an ingest status, and a job's, which agrees with `tâche`",
    },
    forget: {
      reads: ['retirer', 'oublier'],
      separates:
        'a post preset taken off the list, and a memory the assistant lets go of — which is ' +
        'written down rather than erased, so « retirer » would say the opposite of what happens',
    },
    free: {
      reads: ['libre', 'gratuit'],
      separates: 'a camera aiming at nothing, and what a generation costs',
    },
    group: { reads: ['grouper', 'groupe'], separates: 'the command, and the layer it makes' },
    home: { reads: ['début', 'accueil'], separates: 'the Home key, and the home screen' },
    light: { reads: ['lumière', 'clair'], separates: 'a scene light, and the light theme' },
    media: { reads: ['média', 'médias'], separates: "one file's section, and the setting for all" },
    metalness: {
      reads: ['métallicité', 'métal'],
      separates:
        'the 3D inspector writes the trade word beside `Rugosité`, the materials panel the short ' +
        'one that fits a tile — `docs/fr/manuel/12-espace-matieres.md` says so in as many words. ' +
        'Nothing conceptual separates them: a product call, not a translation one',
    },
    import: {
      reads: ['importer', 'import'],
      separates: 'the File menu, whose rows are verbs, and the journal filter, whose are nouns',
    },
    move: {
      reads: ['déplacer', 'déplacement'],
      separates: 'the scene command, and the canvas tool, whose palette names its tools as nouns',
    },
    'new project': {
      reads: ['créer un projet', 'nouveau projet'],
      separates: 'the button that does it, and the menu entry that names it',
    },
    none: { reads: ['aucune', 'aucun'], separates: 'agreement — a material, and a model' },
    normal: {
      reads: ['normal', 'normale'],
      separates: 'the blend mode, which carries the CSS name, and the normal map',
    },
    open: {
      reads: ['ouvrir', 'ouvert'],
      separates:
        'the action, and a state — nothing reads the KEY `shell.explorer.open`, measured 18/08, ' +
        'so what shows it is unknown rather than settled. Grepping `explorer.open` finds five ' +
        'sites and none of them is it: they are the `LogScope` of the same name',
    },
    pause: {
      reads: ['mettre en pause', 'pause'],
      separates: "the inspector's action, and the transport button, which has room for a word",
    },
    scale: {
      reads: ['redimensionner', 'échelle'],
      separates: 'the scene command, and the property the canvas and the animation show',
    },
    size: {
      reads: ['taille', 'corps'],
      separates: "a dimension, and a font's body size, as the trade names it",
    },
    upscale: {
      reads: ['agrandir', 'agrandissement'],
      separates: 'the canvas command, and the billed action — the mirror of `agrandissement`',
    },
  }

  const FRENCH_FORMS = formsOf(BUNDLES.en, REFERENCE)

  it('renders a repeated English label the same way in French', () => {
    expect(driftedIn(FRENCH_FORMS, TWO_WAYS)).toEqual([])
  })

  it('drops a French exemption once the label stops reading both ways', () => {
    expect(staleIn(FRENCH_FORMS, TWO_WAYS)).toEqual([])
  })

  /**
   * The blind spot of both tables above, and it took a manual sentence to see it: `formsOf`
   * groups by the SOURCE term, so a label shortened on BOTH sides at once lands in no group and
   * neither table can reach it. `docs/fr/manuel/12-espace-matieres.md` says the panel shortens
   * THREE channel names; only `metalness` ever surfaced, its English having stayed put.
   *
   * So the channels are read by KEY instead: `material.channel.<c>` against the 3D inspector's
   * name for the same channel, every language. Four of the five comparable ones diverge.
   */
  const INSPECTOR_FIELD: Record<PbrChannel, string | null> = {
    baseColor: 'map',
    normal: 'normalMap',
    // The scalars, not `roughnessMap`/`metalnessMap`: those two wear `Carte de` to part the map
    // from the slider of the same name beside them, which `normalMap` and `aoMap` never needed.
    roughness: 'roughness',
    metalness: 'metalness',
    ao: 'aoMap',
    // No material field of their own in the 3D inspector — `inspector.fields.height` is the box
    // dimension, next to `Segments en hauteur`, and rhyming with it would be the false pair.
    height: null,
    emissive: null,
    edge: null,
  }

  /**
   * Channels the two surfaces name differently on purpose — each entry saying why, and leaving
   * the day both agree again. A channel absent here and divergent is drift, in either language.
   */
  const NAMED_TWICE: Partial<Record<PbrChannel, string>> = {
    normal: 'the inspector counts them, as the trade writes the map; the tile names one channel',
    metalness: 'the trade word beside `Rugosité`, and the short one that fits a tile',
    ao: 'the full name beside the other maps, and the short one that fits a tile',
  }

  /** Empty for a channel the inspector has no field for: nothing to diverge, nothing to exempt. */
  const namesOf = (channel: PbrChannel) => {
    const field = INSPECTOR_FIELD[channel]

    return field === null
      ? []
      : CODES.map(code => [
          BUNDLES[code].get(`material.channel.${channel}`),
          BUNDLES[code].get(`inspector.fields.${field}`),
        ])
  }

  it('names a PBR channel the same way on the tile and in the 3D inspector', () => {
    const drifted = PBR_CHANNELS.filter(channel => NAMED_TWICE[channel] === undefined).filter(
      channel => namesOf(channel).some(([tile, field]) => tile !== field),
    )

    expect(drifted).toEqual([])
  })

  it('drops a channel exemption once both surfaces say the same word', () => {
    const settled = PBR_CHANNELS.filter(channel => NAMED_TWICE[channel] !== undefined).filter(
      channel => namesOf(channel).every(([tile, field]) => tile === field),
    )

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
   * The reading beside the spelling one, and the same trap: `assistant.fields.easing` said `Speed
   * curve of the travelling`, the French noun for what this studio calls a camera move. Nothing
   * above could see it — the guards there compare a label to its OTHER readings, and this one was
   * written once. Shared with the manual for the reason the spelling reading is: chapter 09 wrote
   * the same borrowing, in prose that quotes this very label.
   */
  it('writes its own English word rather than a French one', () => {
    const borrowed = [...BUNDLES.en].flatMap(([key, text]) =>
      (BORROWED_IN_ENGLISH.has(key) ? [] : frenchWords(text)).map(word => `${key} — ${word}`),
    )

    expect(borrowed).toEqual([])
  })

  /**
   * The same reasoning as the `SETTLED_WORDS.except` guard above, applied to the three sets the
   * two readings above take: an exemption whose key no longer says the word — or no longer
   * exists — is one nobody would think to delete, and the next reader takes it for a rule.
   */
  it('drops a spelling exemption once its key stops needing it', () => {
    const stale = [
      ...[...NAMED_AS_THE_API_BILLS_IT].filter(
        key => americanVerbs(BUNDLES.en.get(key) ?? '').length === 0,
      ),
      ...[...NAMED_AS_CSS_BLENDS_THEM].filter(
        key => americanWords(BUNDLES.en.get(key) ?? '').length === 0,
      ),
      ...[...BORROWED_IN_ENGLISH].filter(
        key => frenchWords(BUNDLES.en.get(key) ?? '').length === 0,
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
 * The label AND the sentence beside it, which is the shape `choicesOf` composes: a union whose
 * values each explain themselves goes missing in two ways, never one.
 */
function explained(prefix: string, values: readonly string[]): string[] {
  return values.flatMap(value => [`${prefix}${value}`, `${prefix}${value}Hint`])
}

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
  // Every word the component registry names, read off the registry itself. A third component,
  // or a fourth value of a choice, arrives with its lines or this goes red — the descriptor is
  // read through `t(<variable>)` from the add menu, the section heading and every field label,
  // so nothing else would see it.
  ...Object.values(COMPONENTS).flatMap(descriptor => [
    descriptor.titleKey,
    descriptor.descriptionKey,
    ...descriptor.fields.map(field => field.labelKey),
    ...descriptor.fields.flatMap(field => (field.options ?? []).map(one => `game.values.${one}`)),
  ]),
  // The ways into a first context card, read off the list rather than off a literal: a model
  // added without its two lines would offer the reader its own key as a menu row.
  ...CONTEXT_TEMPLATES.flatMap(template => [template.titleKey, template.bodyKey]),
  // The six sides and the seven ways of drawing them. Composed on BOTH sides now — the 3D bar
  // offers them as modes, and the native View menu offers a row each — which is exactly why the
  // lists moved here: a menu is built in the main process, out of reach of the renderer's guard.
  ...VIEW_DIRECTIONS.flatMap(direction => [
    `sceneViews.${direction}`,
    `sceneViews.${direction}Hint`,
  ]),
  ...explained('sceneDisplay.', DISPLAY_MODES),
  // The definitions the capture row offers. Composed in the MAIN process, out of reach of the
  // renderer's guard — a fifth one without its line would read as its own key inside a menu.
  ...CAPTURE_QUALITIES.map(quality => `sceneCaptureQualities.${quality}`),
  // The unions of `domain/scene` the 3D inspector composes a label AND a sentence from, none of
  // them listed until now: a value without its line reads as its own key, on the very rows a
  // select explains itself with.
  ...explained('environment.source_', ENVIRONMENT_KINDS),
  ...explained('environment.background_', BACKGROUND_KINDS),
  ...explained('environment.fog_', FOG_KINDS),
  ...explained('environment.tone_', TONE_MAPPINGS),
  ...explained('environment.visibility_', HELPER_VISIBILITIES),
  ...explained('environment.quality_', VIEWPORT_QUALITIES),
  ...explained('environment.unit_', DISPLAY_UNITS),
  // The composition catalogue, composed on three sides at once — the stack rows, the library and
  // the inspector's generated controls. An effect added without its two lines would offer the
  // reader its own identifier as a row of the Add menu.
  ...explained('postfx.effect_', POST_EFFECT_IDS),
  ...POST_CATEGORIES.map(category => `postfx.category_${category}`),
  ...POST_COSTS.map(cost => `postfx.cost_${cost}`),
  ...explained('postfx.mode_', CAMERA_POST_MODES),
  ...POST_PRESET_IDS.map(preset => `postfx.preset_${preset}`),
  // Every parameter of every effect, and every value of every closed list one offers. The panel
  // is GENERATED from the catalogue, so a knob without a line is a knob labelled by its own key.
  ...POST_EFFECT_IDS.flatMap(effect =>
    Object.keys(POST_EFFECTS[effect].params).map(param => `postfx.param_${param}`),
  ),
  ...POST_EFFECT_IDS.flatMap(effect =>
    Object.values(POST_EFFECTS[effect].params).flatMap(spec =>
      spec.control === 'choice' ? spec.options.map(option => `${spec.labelPrefix}${option}`) : [],
    ),
  ),
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
  // The version panel groups by stage and names the change in each row's hint, both composed
  // from the union. A value without its line puts the raw word — `untracked` — where a heading
  // belongs. The BADGE is not here: its letter is git's own, and it lives in `GIT_CHANGE_BADGES`.
  ...GIT_STAGES.map(stage => `git.stage.${stage}`),
  ...GIT_CHANGES.map(change => `git.change.${change}`),
  // The three kinds of name a commit can carry, each drawn as its own badge.
  ...GIT_REF_KINDS.map(kind => `git.ref.${kind}`),
  // Why git did not answer. The compiler holds the other half — see `GIT_FAILURE_KEYS`.
  ...Object.values(GIT_FAILURE_KEYS),
  /**
   * The models the assistant may think with, named in the picker of its own modal.
   *
   * Here rather than trusted to `exhaustive.test.ts`, which proves the LIST covers the union and
   * says nothing about the bundles: a fifth model added there and forgotten here would read as
   * `gemini-4-flash` in an otherwise French list — the family of defect the usage report already
   * shipped once, with `images-generation` sitting in a French table.
   */
  ...ASSISTANT_MODELS.map(model => `assistant.models.${model}`),
  // Composed from the shared PBR union to name a link row of the material inspector. This family
  // has no compiler guard, so a ninth channel — and the domain warns the API adds types without
  // notice — would label its row with its own key.
  ...PBR_CHANNELS.map(channel => `material.channel.${channel}`),
  // The usage report showed what the API called things — `images-generation` sat in a French
  // table, and `video` beside a `Vidéo` the bundle already knew.
  ...USAGE_ACTIONS.map(action => `usage.actionNames.${action}`),
  // The journal's own union, wider: what happened, not only what was billed.
  ...USAGE_EVENT_ACTIONS.map(action => `usage.actionNames.${action}`),
  ...USAGE_ASSET_KINDS.map(kind => `usage.assetKinds.${kind}`),
  // What the microphone answered, said in the language of whoever is reading. The detail of a
  // failure never reaches the screen — it names a file path — so the code is all there is.
  ...STT_ERROR_CODES.map(code => `dictation.errors.${code}`),
  // The employments no space holds. The generation ones are named by `families` and
  // `capabilities` above, which the manager reuses rather than opening a second vocabulary.
  ...STANDALONE_ROLES.map(role => `aiRoles.${role}`),
  // The verdict the machine returns on a model. A value without its word would put a raw key on
  // the one line that says whether an AI can run here at all.
  ...COMPATIBILITIES.map(fit => `aiModels.fit.${fit}`),
  // A cloud is named by its REGISTRY entry, so the second one to arrive needs no code change —
  // and no line here either. Without its two keys it would offer itself as `aiClouds.x`.
  ...CLOUD_IDS.flatMap(id => [`aiClouds.${id}`, `aiClouds.${id}Hint`]),
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
   * some other way — `the edit`, `the audio editor` — says nothing this can check. Two of the
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

describe('a menu path a sentence quotes', () => {
  /**
   * `manual.i18n.test.ts` holds this for the twenty chapters, where a wrong path reads as the
   * software being broken. The bundles quote one too — `home.spotlight.connectBody` sends a
   * newcomer to `Réglages ▸ Compte` — and nothing read it: a renamed entry would have left that
   * sentence pointing at a menu nobody can find, in the one window shown before anything works.
   *
   * ONE site today, so the value is prospective; the manual's twin has gone stale three times.
   *
   * Its blind spot, and the manual's guard shares it: a segment is checked against EVERY label
   * the screen carries, not against the menu alone. A path renamed onto a word that happens to
   * be a panel title or a button elsewhere would pass — the bundles hold no menu-only index.
   */
  it.each(CODES)('quotes no menu path the screen does not carry, in %s', code => {
    const labels = screenLabels(TRANSLATIONS[code])
    const rooted = {
      root: asRead(TRANSLATIONS[code].settings.title),
      tree: settingsTree(TRANSLATIONS[code]),
    }
    const invented = [...BUNDLES[code]].flatMap(([key, value]) =>
      unquotedMenuSegments(value, labels, rooted).map(found => `${key} — ${found}`),
    )

    expect(invented).toEqual([])
  })

  /** The assertion above is a list expected EMPTY: a reading that finds nothing keeps it green. */
  it('slides from the separator onto the labels around it, and says when it cannot', () => {
    const labels = new Set(['réglages', 'compte'])

    expect(unquotedMenuSegments('Collez-les dans Réglages ▸ Compte — chiffrés.', labels)).toEqual(
      [],
    )
    expect(unquotedMenuSegments('Collez-les dans Réglages ▸ Trousseau.', labels)).toEqual([
      '"Trousseau" in Collez-les dans Réglages ▸ Trousseau',
    ])
  })

  /**
   * Three sources feed one root, and a path may name any of them. Missing the actions read
   * `Réglages ▸ Avancé ▸ Outils de développement` as invented — a true path, called false.
   */
  it('carries the screens, the settings AND the actions of a root section', () => {
    const held = settingsTree(TRANSLATIONS.fr).get(asRead(TRANSLATIONS.fr.settings.ai))

    expect(held?.has(asRead(TRANSLATIONS.fr.settings.account))).toBe(true)
    expect(
      settingsTree(TRANSLATIONS.fr)
        .get(asRead(TRANSLATIONS.fr.settings.advanced))
        ?.has(asRead(TRANSLATIONS.fr.settings.openDevtools.title)),
    ).toBe(true)
  })

  /**
   * The reading above is the whole screen; this one is the window the path opens on. Both cases
   * are green without `rooted`, which is what let `Réglages ▸ Compte` ship.
   */
  it('reads a settings path against the SECTIONS, not against every label on screen', () => {
    const labels = new Set(['réglages', 'compte', 'clés api', 'modèles d’ia'])
    const rooted = {
      root: 'réglages',
      tree: new Map([['modèles d’ia', new Set(['clés api'])]]),
    }

    expect(
      unquotedMenuSegments('Collez-les dans Réglages ▸ Modèles d’IA ▸ Compte.', labels, rooted),
    ).toEqual(['"Compte" in Collez-les dans Réglages ▸ Modèles d’IA ▸ Compte'])
    expect(unquotedMenuSegments('Collez-les dans Réglages ▸ Clés API.', labels, rooted)).toEqual([
      '"Clés API" in Collez-les dans Réglages ▸ Clés API',
    ])
    expect(
      unquotedMenuSegments('Collez-les dans Réglages ▸ Modèles d’IA ▸ Clés API.', labels, rooted),
    ).toEqual([])
  })
})

/**
 * English words one surface owns, each paired with the French it always translates. A sentence
 * that writes the English word where the French says something else has borrowed a word that
 * already names another thing on screen.
 */
const OWNED_WORDS: readonly { english: RegExp; french: RegExp; owns: string }[] = [
  {
    english: /\blayers?\b/i,
    french: /calqu/i,
    owns: 'a sheet of the image stack',
  },
]

/**
 * Keys that write an owned English word in another of its senses. Empty today, and measured so:
 * every `layer` of the English bundles pairs with a French `calque`.
 *
 * It exists so the day a MaterialX layer or a three.js layer mask reaches the screen has an
 * answer other than widening the pattern until it says nothing.
 */
const ANOTHER_SENSE: ReadonlySet<string> = new Set<string>()

const borrowedWords = (english: Map<string, string>, french: Map<string, string>) =>
  OWNED_WORDS.flatMap(word =>
    [...english]
      .filter(
        ([key, value]) =>
          word.english.test(value) &&
          !word.french.test(french.get(key) ?? '') &&
          !ANOTHER_SENSE.has(key),
      )
      .map(([key]) => `${key} — borrows the word of ${word.owns}`),
  )

describe('a word one surface owns', () => {
  /**
   * `assistant.actions.cameraShot.description` told an assistant which `layer` a camera shot
   * lands on, where the French said `étage` and the manual says `line` — `layer` naming a sheet
   * of the image stack everywhere else. `TWO_THINGS` cannot see it: it reads labels, and drops
   * anything ending in a full stop.
   *
   * Three blind spots. It reads the English SIDE only — a French `calque` translated some other
   * way is legitimate twice today (`Merge down`, `a layered canvas`) and stays unwatched. It
   * reads bundle values, never a word joined in code. And an entry is a pair of words, not a
   * glossary: a word the French owns alone has nothing to pair with here.
   */
  it('never lends an English word to a sentence the French says otherwise', () => {
    expect(borrowedWords(BUNDLES.en, REFERENCE)).toEqual([])
  })

  /** The assertion above is a list expected EMPTY: a reading that finds nothing keeps it green. */
  it('reads the pair rather than the English alone', () => {
    expect(
      borrowedWords(new Map([['k', 'Which layer it lands on']]), new Map([['k', 'L’étage suit']])),
    ).toEqual(['k — borrows the word of a sheet of the image stack'])
    expect(
      borrowedWords(
        new Map([['k', 'Merge the layer down']]),
        new Map([['k', 'Fusionner le calque du dessous']]),
      ),
    ).toEqual([])
  })

  /**
   * An entry whose word left the screen watches nothing, and the next reader reads it as a rule
   * still held — the failure `staleIn` exists for above, on the same file's exemptions.
   */
  it.each(OWNED_WORDS)('still reads $owns on both sides', word => {
    expect([...BUNDLES.en.values()].some(value => word.english.test(value))).toBe(true)
    expect([...REFERENCE.values()].some(value => word.french.test(value))).toBe(true)
  })
})
