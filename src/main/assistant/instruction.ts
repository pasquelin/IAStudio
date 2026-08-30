import {
  ACTION_FAMILIES,
  ACTION_REGISTRY,
  assistantAction,
  DISCOVERY_ACTION,
  findActions,
  MOST_LOADED,
  type AssistantThought,
  type ActionField,
  type ActionName,
  type AssistantAction,
  HISTORY_MAX,
  MOST_QUESTIONS,
} from '@shared/domain/assistant'
import { MEMORY_RECALL_ACTION } from '@shared/domain/memoryActions'
import { CONTEXT_COMPOSED_MAX } from '@shared/domain/projectContext'
import type { Target } from '@shared/domain/target'
import { englishText } from '@shared/i18n'
import { linesWithin, STATE_MAX } from './studioState'

/**
 * What the model is told before it answers.
 *
 * Two kinds of sentence live here, and the difference is worth stating because they sit five
 * lines apart. The CATALOGUE — what each action is and what its fields mean — comes from the
 * English bundle, because those same sentences are shown on screen and one source is the only
 * way they stay one thing. `ROLE` and `FORMAT` are written here as literals, because they are
 * shown to nobody: they are a prompt, which is code, and putting a prompt in a translation
 * bundle would invite someone to translate the one thing that must not move.
 *
 * English throughout either way — see `englishText`, which the window uses for the other half of
 * the same conversation.
 */

/**
 * One target, as a line the model can read. The id first because it is what `target.select` takes
 * back — a model that read the name first tends to answer with the name.
 */
function targetLine(target: Target): string {
  const selected = target.selected ? ' (selected)' : ''
  return `  ${target.id} — ${target.kind} "${target.name}"${selected}`
}

/** One field, as a line the model can read: name, type, whether it must be there, what it takes. */
function fieldLine(field: ActionField): string {
  const parts = [`${field.key} (${field.kind}${field.required ? ', required' : ''})`]
  if (field.options) parts.push(`one of: ${field.options.join(', ')}`)
  parts.push(englishText(field.labelKey))
  return `    - ${parts.join(' — ')}`
}

/** One action's MANUAL: what it is for, and every field it takes. */
function actionBlock(action: AssistantAction): string {
  const lines = [`  ${action.name} — ${englishText(action.descriptionKey)}`]
  for (const field of action.fields) lines.push(fieldLine(field))
  return lines.join('\n')
}

/**
 * 🛑 One manual and WHOSE it is, carried together rather than re-derived: a scan of the composed
 * text for `\n  <name> — ` also matches a project context that happens to be shaped that way, and
 * a block split by position breaks the day a translated label carries a newline.
 */
type Manual = { readonly name: ActionName; readonly text: string }

/** The manuals a briefing carries, in the order the chain opened them. */
const manualPrinted = (loaded: readonly ActionName[]): readonly Manual[] =>
  loaded
    .flatMap(name => assistantAction(name) ?? [])
    .map(action => ({ name: action.name, text: actionBlock(action) }))

const manualText = (manuals: readonly Manual[]): string => manuals.map(one => one.text).join('\n')

/**
 * 🛑 The whole registry as NAMES, headed by the family that publishes it — 4 225 characters where
 * the manuals of the same 283 actions run to 90 994, which no door but the widest could hold.
 */
let namesHeld: string | null = null

const namesPrinted = (): string =>
  (namesHeld ??= ACTION_FAMILIES.map(
    family => `  [${family.name}] ${family.actions.map(one => one.name).join(', ')}`,
  ).join('\n'))

/**
 * 🛑 Every name of the registry, and that is the point of showing names: a model may call anything
 * it can read. `parseReply` still refuses what the registry does not declare.
 */
let allowedHeld: ReadonlySet<ActionName> | null = null

const allNames = (): ReadonlySet<ActionName> =>
  (allowedHeld ??= new Set(ACTION_REGISTRY.map(action => action.name)))

/**
 * The shape the answer has to take.
 *
 * Stated twice — as a sentence and as an example — because the one thing this whole file exists
 * to obtain is a parseable object, and the cheapest model on the list is the one most likely to
 * wrap it in prose if only told once.
 */
const FORMAT = [
  'Answer with one JSON object and nothing else. No prose around it, no code fence.',
  'The object has exactly three keys:',
  '  "say": a short sentence for the person, in their language. May be empty.',
  // 🛑 Two lines of the FORMAT and never a rule of the catalogue: named by a rule, this was
  // described to every model and called by none — the question went in "say" and the calls went
  // out beside it. What gives ground when the room runs out is never this block.
  '  "ask": {"question":"…","choices":[…]} to ask the person, or null. It RUNS NOTHING:',
  '    the calls wait, their answer comes back next round. Ask rather than act halfway.',
  `    Several: {"questions":[{"question":"…","choices":[…],"note":true},…]}, ${MOST_QUESTIONS} max ("note" = a free line).`,
  '  "calls": a list of actions to run, in order. May be empty.',
  'Each call is {"action": "<name from the catalogue>", "input": {<the fields above>}}.',
  // 🛑 A LITERAL id: the example spelled `"<the armed model>"` and the model copied the shape —
  // twenty-three calls over five passes carried `<shotId>` or `<path found>` where a value goes.
  'Example: {"say":"Making an image.","ask":null,"calls":[{"action":"generator.prepare",',
  '"input":{"family":"image","modelId":"flux.1-dev","parameters":{"prompt":"a bicycle"}}},',
  '{"action":"generator.submit","input":{"landing":"document"}}]}',
].join('\n')

/**
 * 🛑 What replaced the eleven-action catalogue, and the whole reason the names fit: an action the
 * briefing did not spell used to cost the entire answer, so a model was told to ask before acting
 * — and, measured, answered « je ne peux pas » instead.
 */
const NAMES_RULE = [
  '  - The catalogue is EVERY action there is, names alone. "Manual" below holds the fields of',
  '    the ones already opened. Name an action that is not there and its fields come back to you',
  '    in the same turn — so call what you mean. Never invent a name, never say you cannot.',
]

const RULES = [
  '  - Only use actions from the catalogue below. Never invent one.',
  '  - One request often needs several calls, in order. Carry it to its end.',
  '  - generator.prepare fills the form and stops. generator.submit sends it and spends credits.',
  // The state below is what the person is looking at. Written as a rule rather than left to be
  // inferred: a model handed a space and a document still opened a second one for the subject of
  // the sentence, which is where "make me a bicycle" became a document named Bicycle.
  '  - Act on what is in front of the person. Only make a document when asked for a new one.',
  // 🛑 A RULE and not two catalogue blocks: printed they cost 158 characters, and a block is the
  // first thing dropped when the room runs out — leaving `project.open` allowed and unspelt.
  '  - Opening a project: projects.list gives their paths, then project.open with {"path":"…"}.',
  ...NAMES_RULE,
  `  - A word rather than a name: ${DISCOVERY_ACTION} with {"query":"…"} answers with what matches.`,
]

/**
 * 🛑 The rules a door has to have ROOM for, and nothing more: naming an action is safe everywhere
 * now that every name is shown, so what sets them apart is the 2 320 characters they cost.
 *
 * Scenario's door leaves 8 500 for the whole briefing and the names alone take 4 225, so it is
 * shown `RULES` and these are what it does without — see `studioBriefing`, which decides on room.
 */
const WIDE_RULES = [
  '  - If nothing in the catalogue fits, return no calls and say so in "say".',
  /**
   * The three that place a NAMED file, and they are one story: a model shown two hundred actions
   * reached for documents.list, which holds documents alone, then said it had found a picture.
   */
  '  - A file the person names is in the project: find it by name there, then file.open it.',
  /**
   * What unblocks a studio spoken to in one language and filled in another: a picture is named
   * after the PROMPT that made it, so "le voilier vert" is on disk as "a beautiful sailing ship,
   * sailboat, on the open sea, green". No wording of a search reaches that — and the model asked
   * three times over to be ALLOWED to list a folder of nine it could simply have read.
   */
  '  - Nothing found by name? List the folders YOURSELF and read the names in them, in this same',
  '    answer. Never ask to be allowed: a name follows the prompt that made it, not what is spoken.',
  '  - Several files match? Choose none: "ask" which, with their names as the choices.',
  // Four requests of the batterie died on a bare name — `files.move ["bateau-test.png"]` for a
  // file sitting in `Images/` — each answered `refused: missing`.
  '  - A path is the WHOLE path inside the project, folders and all: "Images/x.png", never',
  '    "x.png". A name you were TOLD is not a path — find the file, then use the path it answered.',
  // Six runs, none able to answer: asked to rename « la copie », it searched for the NEW name.
  '  - Renaming: the new name is not on disk yet. Find the file by what it is called NOW.',
  '  - Every value is literal. Never write <something> where an id goes: if you do not have it,',
  '    call for it and use what came back on the next round.',
  '  - The remote library is not this project. Look there only when asked to.',
  // Five requests died on it: the decor had just generated a picture, and the model answered
  // « je ne vois aucune image générée » — nothing in the studio block says one was made.
  '  - "that picture", "the result", "the generated model": what a generation made is in the',
  '    project catalogue. assets.searchProjectCatalogue with generated finds it; nothing else announces it.',
  // Twice over, a reference travelled as a PATH under a key nobody reads. The field belongs to
  // the model's own schema, and the value is an asset id.
  '  - To work FROM a picture, read models.readGenerationModelFields first and fill the field it names with an ASSET',
  '    ID — never a path, and never a key you chose yourself.',
  // A plan that reads well and cannot run: opening the picture is what put the Image space in
  // front, and every scene call after it was refused.
  '  - Scene, image and montage actions work on the document IN FRONT, and opening a file changes',
  '    which one that is. Open what you will act on LAST, or bring it back with document.activate,',
  '    which takes its id, its path, or the title the studio shows in quotes.',
  // Narrowed to the repair alone: rule 3 above is what makes a model ask, and it must keep doing
  // so for what the person alone knows.
  '  - Never ask to be allowed to repair your OWN order: do it, and say what you did.',
  // Twelve requests died on a question the studio answers — « sur quel clip ? » to a montage
  // holding one, « quel modèle 3D ? » to a project holding two.
  '  - Rule 3 is for what the person ALONE knows. ONE thing of that kind in front of you is the',
  '    one meant, and a question about what a read would have told you is a turn spent for nothing.',
  '  - "one metre more", "half", "25% more" are RELATIVE. Read the value that stands, do the',
  '    arithmetic, write the result: every field is an absolute value, never a difference.',
  '  - Never say a thing is done unless a call in this conversation did it.',
  '  - Reading is not doing: the request is done once the change it asked for has been WRITTEN.',
  // The same call sent four times after it answered ok, one refusal collected eight times on
  // arguments that never changed.
  '  - A call that answered ok has HAPPENED — sending it again does it twice. A refused call is',
  '    refused again on the same arguments: change them, or do something else.',
]

/**
 * 🛑 The whole of what a briefing says about the memory, and it says it only when there is
 * something to find — a project that has learned nothing pays not one character.
 *
 * A SIGNAL rather than the memories themselves: pushing summaries cost an embedding and a scan of
 * every vector on every turn, for a block the room threw away whole on four doors of five.
 */
const MEMORY_CALL = `  - This project has a memory: ${MEMORY_RECALL_ACTION} answers it. Ask before guessing.`

/**
 * 🛑 What a round after the first is told, and every line of it earns its place.
 *
 * Without the first, a model handed its own history repeats the search it has just run. Without
 * the last, it never stops: answering with no calls is the ONLY way it says a request is done,
 * and nothing else in the briefing asks it to.
 */
const CONTINUING = [
  'You are still working on the same request. What you have already done is in the history',
  'above, with what each action answered — build on it, and never redo a call that has answered.',
  'Answer with NO calls when the request is done. When you need something only the person can',
  'tell you, that is what "ask" is for.',
].join('\n')

const roleWith = (rules: readonly string[]): string =>
  [
    'You drive IA Studio, a desktop application for generating images, video, 3D models,',
    'audio, materials and skyboxes. The person talks to you and you act on their behalf.',
    '',
    'Rules:',
    ...rules,
  ].join('\n')

/**
 * Trims the history to what the model will actually be given.
 *
 * The oldest turns go first: a conversation is understood from its end, and the sentence just
 * spoken matters more than the one before the one before it.
 */
export function recentHistory(history: readonly string[], limit = HISTORY_MAX): string[] {
  return [...history].slice(-limit)
}

export type BriefingParts = {
  /** A round after the first on one sentence — see `CONTINUING`, which is what it adds. */
  continuing?: boolean
  /** The spaces nothing can generate in, so the model says so before promising a picture. */
  notReady?: readonly string[]
  /** What the open project is about, already composed — see `composedContext`. */
  context?: string
  /** What the studio is right now, already in sentences — see `describeStudio`. */
  state?: string
  /**
   * How many memories this project holds. What the briefing pays instead of the memories.
   *
   * 🛑 A COUNT, never a recall — see `memorySignal`. Injecting summaries paid an embedding and a
   * vector scan on every single turn for a block that four doors of five threw away whole.
   */
  memories?: number
  /** Where this machine keeps a person's folders, absolute — see `AssistantThought.folders`. */
  folders?: string
  /** What the open document can be aimed at, narrowed by the window — see `target.ts`. */
  targets?: readonly Target[]
  /**
   * 🛑 What the CHAIN asked for, never the manuals the studio loads from the start: they are the
   * only names that must cross back over the boundary, and the only ones put at the BACK of
   * `loaded` to survive the cut, which bites from the front.
   */
  opened?: readonly ActionName[]

  /** Whose MANUAL this briefing carries — see `AssistantThought.loaded`. */
  loaded?: readonly ActionName[]
  /**
   * 🛑 How much briefing the brain about to carry it can hold — a number that belongs to the
   * BRAIN and not to this file. What the model is SHOWN of the manuals follows from it.
   *
   * Not a ceiling on the whole: the names, the rules and the FORMAT are what never give ground,
   * and a door too tight for them is told fewer rules (`studioBriefing`) rather than fewer names.
   */
  room: number
  /**
   * What the briefing is budgeted against when this door refused the first one — a fact of the
   * door, which has just disproved its own `room`. Defaults to `room`, which is right for a door
   * that was never shown the wide rules in the first place.
   */
  fallbackRoom?: number
}

/**
 * What the model is shown, and what an answer is then held to.
 *
 * 🛑 `allowed` is the whole registry now that the catalogue names it whole, and `loaded` is the
 * narrower thing: what the model has the FIELDS of. A call naming an action outside `loaded` is
 * not refused — `answeredTurn` opens its manual and asks again.
 */
export type Briefing = {
  readonly text: string
  readonly allowed: ReadonlySet<ActionName>
  /** The manuals this briefing CARRIES, oldest first — what has fields, for `unloadedIn`. */
  readonly loaded: readonly ActionName[]
  /** Of those, the ones the CHAIN asked for: what travels back, never the default load. */
  readonly opened: readonly ActionName[]
  /** The same briefing with these manuals opened as well. */
  readonly withLoaded: (names: readonly ActionName[]) => Briefing
  /** The same briefing with what a query found opened, or nothing once one has been answered. */
  readonly expand: ((query: string) => Briefing) | null
  /**
   * The same parts with the wide rules dropped, for a door that REFUSED this one — a door's room
   * is an assumption about a hand-typed model's window. `null` once they are already dropped.
   */
  readonly narrow: (() => Briefing) | null
}

/** A composed briefing and the manuals it KEPT — what the cut decided, not a scan of its text. */
type Written = { readonly text: string; readonly held: readonly ActionName[] }

/**
 * 🛑 What GIVES GROUND when the room runs out, in order: the manuals, the state, the targets, the
 * project context, and the folders. Never the names, never the rules, and never the sentence,
 * which `instructionFor` guarantees.
 */
function briefingText(one: Composition, manual: readonly Manual[], found: string): Written {
  const parts = one.parts
  const state = parts.state ?? ''
  const targets = parts.targets ?? []
  const full = composed(one, manualText(manual), found, state, targets)
  if (full.length <= parts.room) return { text: full, held: manual.map(one => one.name) }

  /**
   * 🛑 The MANUALS give ground FIRST, and the order is the whole lesson of 2026-08-31: they are
   * the only block a chain can ask back (`withLoaded`), and the only one worth 24 000 characters.
   * What is in front of the person is worth a few hundred and cannot be asked back at all —
   * dropped for them, the bench lost six points and 227 turns to refusals.
   *
   * By whole actions and from the FRONT: what a chain opened last is what it is about to call,
   * and half a field line is an action the model cannot see is truncated.
   */
  const blocks = [...manual]
  let over = full.length - parts.room
  while (over > 0 && blocks.length > 0) over -= (blocks.shift()?.text.length ?? 0) + 1
  const held = blocks.map(one => one.name)
  const manuals = manualText(blocks)
  const thinner = composed(one, manuals, found, state, targets)
  if (thinner.length <= parts.room) return { text: thinner, held }

  // Then the state, whose lines are ranked from the most useful — it is prose, and it gives by
  // whole lines where the blocks above gave by whole actions.
  const short = linesWithin(state, Math.max(0, state.length - (thinner.length - parts.room)))
  const trimmed = composed(one, manuals, found, short, targets)
  if (trimmed.length <= parts.room) return { text: trimmed, held }

  /**
   * Then the TAIL of the target list, which is the loss the window already designed for: it ranks
   * them selection first, then the names the sentence spells, then the rest.
   */
  const aimed = targetsWithin(targets, trimmed.length - parts.room)
  const cut = composed(one, manuals, found, short, aimed)
  if (cut.length <= parts.room) return { text: cut, held }

  /**
   * 🛑 Then the project context — a FOURTH step because the two above can both run out: the state
   * is cut by whole lines and the targets by whole entries, so a saturated briefing settles a
   * couple of dozen characters over the room with nothing left to give.
   */
  const room = Math.max(0, (parts.context ?? '').length - (cut.length - parts.room))
  const trimmedContext = withParts(one, { context: linesWithin(parts.context ?? '', room) })
  const last = composed(trimmedContext, manuals, found, short, aimed)
  if (last.length <= parts.room) return { text: last, held }

  // 🛑 `[M]` The folders go WHOLE or not at all: the briefing runs thousands of characters, so the
  // 137-character block overruns any door leaving it less than that.
  const bare = withParts(trimmedContext, { folders: '' })

  return { text: composed(bare, manuals, found, short, aimed), held }
}

function targetsWithin(targets: readonly Target[], over: number): readonly Target[] {
  let dropped = 0
  let saved = 0
  while (saved < over && dropped < targets.length) {
    saved += targetLine(targets[targets.length - 1 - dropped] as Target).length + 1
    dropped += 1
  }

  return targets.slice(0, targets.length - dropped)
}

/** The heading the manuals sit under — named, so a model does not read them as the catalogue. */
const MANUAL_HEAD = 'Manual — the fields of the actions opened so far:'

function composed(
  one: Composition,
  manual: string,
  found: string,
  state: string,
  targets: readonly Target[],
): string {
  const parts = one.parts
  // Silent when everything is served: a line saying nothing is worth no characters.
  const idle =
    parts.notReady && parts.notReady.length > 0
      ? [`No model ready for: ${parts.notReady.join(', ')}.`, '']
      : []
  // Before the catalogue rather than after it: what the project IS frames every action the model
  // might pick, where a note under the list reads as a footnote to the last one.
  const about = parts.context ? ['Project context:', parts.context, ''] : []
  // Before the catalogue, with the rest of what is TRUE of this machine: read after the actions
  // it serves, an absolute path reads as an example rather than as this person's own folder.
  const where = parts.folders ? ['Folders on this machine:', parts.folders, ''] : []
  const now = state ? [state, ''] : []
  // After the catalogue rather than before it: `target.select` is what these ids are for, and a
  // list read before the action that consumes them reads as facts about nothing.
  const aim =
    targets.length > 0
      ? ['Targets in the open document:', targets.map(targetLine).join('\n'), '']
      : []

  return [
    roleWith(one.rules),
    '',
    ...about,
    ...where,
    ...now,
    ...idle,
    'Catalogue:',
    namesPrinted(),
    '',
    ...(manual === '' ? [] : [MANUAL_HEAD, manual, '']),
    ...aim,
    ...(found ? [found, ''] : []),
    ...(parts.continuing ? [CONTINUING, ''] : []),
    FORMAT,
  ].join('\n')
}

/** What the memory costs a briefing, and only where there is something to find. */
const memorySignal = (parts: BriefingParts): readonly string[] =>
  (parts.memories ?? 0) > 0 ? [MEMORY_CALL] : []

/**
 * The briefing with the signal, or without it when it does not FIT.
 *
 * 🛑 It yields to OVERRUNNING alone, and to nothing else: the manuals give ground first and every
 * real door cuts some, so yielding to a cut manual dropped this line from every door under
 * ~97 400 — measured 2026-08-31. What it costs there is the WORST-ranked manual of a queue of 283.
 */
function composedWithSignal(one: Composition, manual: readonly Manual[], found: string): Written {
  const signal = memorySignal(one.parts)
  if (signal.length === 0) return briefingText(one, manual, found)

  const written = briefingText({ ...one, rules: [...one.rules, ...signal] }, manual, found)
  if (written.text.length <= one.parts.room) return written

  // Retried only where the signal is what tipped it over: a briefing over by thousands is over
  // for another reason, and composing it a second time to learn that is waste.
  return written.text.length - one.parts.room > signal.join('\n').length + 1
    ? written
    : briefingText(one, manual, found)
}

/** One briefing's whole decision: the parts, which rules it was given, and what it may fall to. */
type Composition = {
  readonly parts: BriefingParts
  readonly rules: readonly string[]
  readonly narrow: (() => Briefing) | null
  /** Set once a query has been answered: an expansion of an expansion talks to itself. */
  readonly found?: string
}

const withParts = (one: Composition, patched: Partial<BriefingParts>): Composition => ({
  ...one,
  parts: { ...one.parts, ...patched },
})

/**
 * 🛑 The names asked for go to the BACK, even ones already there: the cut bites from the front,
 * so `loadedWith` — which dedupes by keeping the position — let a manual that was asked for be
 * cut a second time, and the loop asked for it again until the budget ran out.
 */
const atBack = (
  held: readonly ActionName[],
  names: readonly ActionName[],
): readonly ActionName[] => [...held.filter(name => !names.includes(name)), ...names]

const askedFor = (one: Composition, names: readonly ActionName[]): Composition =>
  withParts(one, {
    loaded: atBack(one.parts.loaded ?? [], names),
    // 🛑 The same move, and `loadedWith` was the wrong one: it dedupes by KEEPING the position, so
    // a re-asked manual crossed the turn boundary still at the front, where the next cut took it.
    opened: atBack(one.parts.opened ?? [], names).slice(-MOST_LOADED),
  })

function briefingOf(one: Composition): Briefing {
  const asked = one.parts.loaded ?? []
  /**
   * 🛑 What the text CARRIES, never what was asked for: the manuals give ground first, so a room
   * too tight prints a share of them. Reported as asked, `unloadedIn` sees nothing to reopen and
   * the call goes out on guessed fields — 40 asked, 7 printed, and every gate green.
   */
  const written = composedWithSignal(one, manualPrinted(asked), one.found ?? '')
  const held = new Set(written.held)
  /**
   * 🛑 Two readings, and confusing them costs a turn: `unloadedIn` asks for what has FIELDS, so
   * everything printed; the boundary must return only what the CHAIN asked for, or 283 names
   * cross it every turn. Without `opened`, the caller IS the chain.
   */
  const opened = (one.parts.opened ?? asked).filter(name => held.has(name))

  return {
    text: written.text,
    allowed: allNames(),
    loaded: written.held,
    opened,
    withLoaded: names => briefingOf(askedFor(one, names)),
    expand: one.found === undefined ? query => expandedWith(one, query) : null,
    narrow: one.narrow,
  }
}

/**
 * Everything but the person's sentence, sized to the room the brain has: the names of every action
 * whatever the door, and as many rules as the room holds. Nothing here names a cloud or a runtime.
 */
export function studioBriefing(parts: BriefingParts): Briefing {
  const narrow = (): Briefing => narrowBriefing(parts)
  // The rules alone settle it, and settle it without composing: a door too tight for them keeps
  // its state and its context instead, which are what the wide set would take.
  if (parts.room < wideFloor()) return narrow()

  const wide = briefingOf({ parts, rules: WIDE_ALL, narrow })

  return wide.text.length > parts.room ? narrow() : wide
}

const WIDE_ALL: readonly string[] = [...RULES, ...WIDE_RULES]

/**
 * The room the wide rules ASK FOR: their own bare briefing, plus what has to fit beside it — the
 * studio's state, the project context, and three manuals at the registry's own average.
 *
 * 🛑 The reserve is the whole point and it is measured: budgeted on the bare cost alone,
 * Scenario's door took the wide set at 8 364 of its 8 500 and then dropped its state, its context
 * and every manual to fit — a briefing that can never open a field.
 */
let floorHeld: number | null = null

const wideFloor = (): number =>
  (floorHeld ??=
    composed({ parts: { room: 0 }, rules: WIDE_ALL, narrow: null }, '', '', '', []).length +
    STATE_MAX +
    CONTEXT_COMPOSED_MAX +
    3 * meanManual())

/** What one manual typically costs — read off the registry, never written down. */
const meanManual = (): number =>
  Math.ceil(
    ACTION_REGISTRY.reduce((sum, one) => sum + actionBlock(one).length + 1, 0) /
      ACTION_REGISTRY.length,
  )

function narrowBriefing(declared: BriefingParts): Briefing {
  return briefingOf({
    parts: { ...declared, room: declared.fallbackRoom ?? declared.room },
    rules: RULES,
    narrow: null,
  })
}

/**
 * The briefing one turn is answered against, composed ONCE and outside any retry: a complaint
 * quotes an answer, and a second reading would ship a briefing the complaint was not about.
 *
 * The three brains differ here in one number — their room — and in nothing else.
 */
export async function briefingFor(
  request: AssistantThought,
  room: number,
  notReady?: () => Promise<readonly string[]>,
  fallbackRoom = room,
): Promise<Briefing> {
  return studioBriefing({
    continuing: request.continuing === true,
    notReady: await notReady?.(),
    context: request.context,
    folders: request.folders,
    memories: request.memories,
    state: request.state,
    targets: request.targets,
    /**
     * 🛑 EVERY manual, and the room decides how many survive — `briefingText` cuts them first
     * and `loaded` reports what it printed, so a narrow door asks the rest back. Measured
     * 2026-08-31 over the 437 scenarios of `pnpm banc`: opened on demand instead, the same
     * scenarios passed 56% against 65%, and reached 214 actions against 243.
     */
    loaded: withChainLast(request.loaded ?? []),
    opened: request.loaded ?? [],
    room,
    fallbackRoom,
  })
}

/**
 * Every manual, with the ones the chain asked for LAST: `briefingText` cuts from the front, so
 * what was asked for is what survives a room too tight to hold them all.
 */
const withChainLast = (opened: readonly ActionName[]): readonly ActionName[] => [
  ...ACTION_REGISTRY.map(one => one.name).filter(name => !opened.includes(name)),
  ...opened,
]

const actionsCounted = (many: number): string => (many === 1 ? '1 action' : `${many} actions`)

const foundHeader = (query: string): string =>
  `The manual above holds every action matching "${query}". Call one rather than asking again.`

const nothingFound = (query: string): string =>
  `Nothing in the catalogue matches "${query}". Say so rather than inventing an action.`

/**
 * 🛑 NOT the same sentence as `nothingFound`, and the difference is the whole point: a door whose
 * room barely covers the names plus a full project context has NOTHING left, so not one matched
 * manual fits. Told "nothing matches", the model says so to the person, about actions that exist.
 */
const noRoomFound = (query: string, matched: number): string =>
  `The catalogue has ${actionsCounted(matched)} matching "${query}", and this briefing has no ` +
  `room for the fields. Say so rather than guessing at one.`

/** The middle of the two above: a narrow door describes a share, and the rest stay out of reach. */
const partlyFound = (query: string, kept: number, matched: number): string =>
  `The manual above holds ${kept} of the ${actionsCounted(matched)} matching "${query}", and has ` +
  `no room for the rest. Call one of those rather than guessing at another.`

/**
 * 🛑 Counted on `matched` throughout, never on what was left to OPEN: a wide door prints every
 * manual from the start, so nothing is ever left to open — and read that way the block said
 * "nothing matches" about 28 actions described three lines above (measured 2026-08-31).
 */
const foundBlock = (query: string, matched: readonly ActionName[], kept: number): string => {
  if (matched.length === 0) return nothingFound(query)
  if (kept === 0) return noRoomFound(query, matched.length)

  return kept < matched.length ? partlyFound(query, kept, matched.length) : foundHeader(query)
}

/**
 * 🛑 The LONGEST sentence this block can end on. Counted against a shorter one, the delivered text
 * holds one manual FEWER than announced — 946 lying rooms measured 2026-08-31, telling the model
 * to call one of a set it cannot read. Against this one the count can only understate.
 */
const widestFound = (query: string, matched: readonly ActionName[]): string =>
  [
    foundHeader(query),
    noRoomFound(query, matched.length),
    partlyFound(query, matched.length, matched.length),
  ].reduce((one, other) => (one.length >= other.length ? one : other))

/**
 * The same briefing with what one query found opened, cut to the room by whole ACTIONS.
 *
 * Cut by blocks rather than by characters: half a field line is an action the model cannot call
 * and cannot see is truncated, which is the one failure this whole mechanism exists to avoid.
 */
function expandedWith(one: Composition, query: string): Briefing {
  const matched = findActions(query).map(action => action.name)
  if (matched.length === 0) return briefingOf({ ...one, found: nothingFound(query) })

  /**
   * 🛑 ALL of them to the back, not merely the ones missing: a match already printed stays where
   * the cut can take it, so asking about a topic printed FEWER of its manuals than not asking —
   * 16 rooms between 20 000 and 30 000. And only `askedFor` fills `opened`, so a match that was
   * already held never crossed back and the chain rediscovered it every turn.
   *
   * Worst to best, because the cut keeps the TAIL: the other way round, what room was left
   * described the poorest answers.
   */
  const asked = askedFor(one, [...matched].reverse())
  const widest = widestFound(query, matched)
  const probe = briefingOf({ ...asked, found: widest })
  const kept = matched.filter(name => probe.loaded.includes(name)).length
  const found = foundBlock(query, matched, kept)
  if (found === widest) return probe

  // 🛑 The room the count was taken in, kept: composed against its own shorter footer the text
  // frees one more manual, and the sentence then says "no room for their fields" about a manual
  // printed above it — eight rooms measured 2026-08-31.
  const spare = widest.length - found.length

  return briefingOf({ ...withParts(asked, { room: asked.parts.room - spare }), found })
}

/**
 * A briefing and a sentence as ONE field, for the door that takes an instruction rather than
 * turns — see `brainProvider`. The cap falls on the sentence: trimming the end would take off
 * the very sentence the person typed and leave the catalogue intact, which is exactly backwards.
 */
export function instructionFor(briefing: string, utterance: string, ceiling: number): string {
  const preamble = preambleOf(briefing)
  return preamble + utterance.slice(0, Math.max(0, ceiling - preamble.length))
}

// 🛑 A function and not a `const`, however single its use: `no-hardcoded-text.test.ts` reads a
// sentence BOUND to a name as a line bound for a screen, and this one is bound for a model.
const preambleOf = (briefing: string): string => `${briefing}\n\nThe person says:\n\n`
