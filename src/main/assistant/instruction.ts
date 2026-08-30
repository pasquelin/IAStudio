import {
  ACTION_FAMILIES,
  ACTION_REGISTRY,
  assistantAction,
  DISCOVERY_ACTION,
  findActions,
  loadedWith,
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

/** The manuals a briefing carries, in the order the chain opened them. */
const manualPrinted = (loaded: readonly ActionName[]): string =>
  loaded
    .flatMap(name => assistantAction(name) ?? [])
    .map(actionBlock)
    .join('\n')

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
  /** The manuals this briefing carries, oldest first. What the turn hands back to the window. */
  readonly loaded: readonly ActionName[]
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

/**
 * 🛑 What GIVES GROUND when the room runs out, in order: the state, the targets, the project
 * context, the folders, and — last of all — the manuals. Never the names, never the rules, and
 * never the sentence, which `instructionFor` guarantees.
 */
function briefingText(one: Composition, manual: string, found: string): string {
  return briefingWithin(one, manual, found).text
}

/** The same, saying whether the manuals had to give ground — what the memory signal yields to. */
function briefingWithin(
  one: Composition,
  manual: string,
  found: string,
): { text: string; cut: boolean } {
  const parts = one.parts
  const state = parts.state ?? ''
  const targets = parts.targets ?? []
  const full = composed(one, manual, found, state, targets)
  if (full.length <= parts.room) return { text: full, cut: false }

  // The state gives ground first — it is prose, and its lines are ranked from the most useful.
  const short = linesWithin(state, Math.max(0, state.length - (full.length - parts.room)))
  const trimmed = composed(one, manual, found, short, targets)
  if (trimmed.length <= parts.room) return { text: trimmed, cut: false }

  /**
   * Then the TAIL of the target list, which is the loss the window already designed for: it ranks
   * them selection first, then the names the sentence spells, then the rest. Dropping from the
   * end is dropping what the sentence never mentioned.
   */
  const aimed = targetsWithin(targets, trimmed.length - parts.room)
  const cut = composed(one, manual, found, short, aimed)
  if (cut.length <= parts.room) return { text: cut, cut: false }

  /**
   * 🛑 Last, the project context — and it is a THIRD step because the two above can both run out:
   * the state is cut by whole lines and the targets by whole entries, so a saturated briefing
   * settles a couple of dozen characters over the room with nothing left to give.
   */
  const room = Math.max(0, (parts.context ?? '').length - (cut.length - parts.room))
  const trimmedContext = withParts(one, { context: linesWithin(parts.context ?? '', room) })
  const last = composed(trimmedContext, manual, found, short, aimed)
  if (last.length <= parts.room) return { text: last, cut: false }

  // 🛑 `[M]` The folders go WHOLE or not at all: the briefing runs thousands of characters, so the
  // 137-character block overruns any door leaving it less than that.
  const bare = withParts(trimmedContext, { folders: '' })
  const dropped = composed(bare, manual, found, short, aimed)
  if (dropped.length <= parts.room) return { text: dropped, cut: false }

  /**
   * 🛑 Last of all the MANUALS, by whole actions and from the FRONT: what a chain opened last is
   * what it is about to call, and half a field line is an action the model cannot see is
   * truncated. Overrunning is NOT the milder failure — a runtime cuts from the HEAD, where the
   * preamble sits (ADR-18).
   */
  const blocks = manualBlocks(manual)
  const held = blocks.length
  let left = dropped.length - parts.room
  while (left > 0 && blocks.length > 0) left -= (blocks.shift()?.length ?? 0) + 1

  return {
    text: composed(bare, blocks.join('\n'), found, short, aimed),
    cut: blocks.length < held,
  }
}

/** The manuals as whole actions: a name line, and the field lines indented under it. */
function manualBlocks(manual: string): string[] {
  const blocks: string[] = []
  for (const line of manual === '' ? [] : manual.split('\n')) {
    if (line.startsWith('    ') && blocks.length > 0) blocks[blocks.length - 1] += `\n${line}`
    else blocks.push(line)
  }

  return blocks
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
 * 🛑 The LAST thing to give ground — after the state, the targets and the project context, and
 * before the manuals: overrunning is not the milder failure, a runtime truncating from the HEAD,
 * where the preamble sits (ADR-18).
 */
function composedWithSignal(one: Composition, manual: string, found: string): string {
  const signal = memorySignal(one.parts)
  const withSignal = { ...one, rules: [...one.rules, ...signal] }
  const written = briefingWithin(withSignal, manual, found)
  // 🛑 `cut` as well as the length: the manuals give ground now, so a briefing that FITS may have
  // paid for this line with one — and the signal is the cheaper of the two to lose.
  if (signal.length === 0 || (written.text.length <= one.parts.room && !written.cut)) {
    return written.text
  }

  // Retried only where the signal is what tipped it over: a briefing over by thousands is over
  // for another reason, and composing it a second time to learn that is waste.
  const over = written.text.length - one.parts.room
  return over > MEMORY_CALL.length + 1 ? written.text : briefingText(one, manual, found)
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

function briefingOf(one: Composition): Briefing {
  const loaded = one.parts.loaded ?? []

  return {
    text: composedWithSignal(one, manualPrinted(loaded), one.found ?? ''),
    allowed: allNames(),
    loaded,
    withLoaded: names => briefingOf(withParts(one, { loaded: loadedWith(loaded, names) })),
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
    loaded: request.loaded,
    room,
    fallbackRoom,
  })
}

const foundHeader = (query: string): string => `The manual above now holds what "${query}" found.`

const nothingFound = (query: string): string =>
  `Nothing in the catalogue matches "${query}". Say so rather than inventing an action.`

/**
 * 🛑 NOT the same sentence as `nothingFound`, and the difference is the whole point: a door whose
 * room barely covers the names plus a full project context has NOTHING left, so not one found
 * manual fits. Told "nothing matches", the model says so to the person, about actions that exist.
 */
const noRoomFound = (query: string, hits: number): string =>
  `${hits} actions match "${query}", and this briefing has no room for their fields. ` +
  `Say so rather than guessing at one.`

const foundBlock = (query: string, hits: number, kept: number): string =>
  hits === 0 ? nothingFound(query) : kept === 0 ? noRoomFound(query, hits) : foundHeader(query)

/** The longest of the three, in characters: the room is budgeted for whichever is emitted. */
const footerRoom = (query: string, hits: number): number =>
  Math.max(foundHeader(query).length, nothingFound(query).length, noRoomFound(query, hits).length)

/**
 * The same briefing with what one query found opened, cut to the room by whole ACTIONS.
 *
 * Cut by blocks rather than by characters: half a field line is an action the model cannot call
 * and cannot see is truncated, which is the one failure this whole mechanism exists to avoid.
 */
function expandedWith(one: Composition, query: string): Briefing {
  const loaded = one.parts.loaded ?? []
  const hits = findActions(query).filter(action => !loaded.includes(action.name))
  // Composed once: measuring by joining a second copy of the same characters is the very waste
  // this file's own history records having removed.
  const fixed = briefingText(one, manualPrinted(loaded), '').length + footerRoom(query, hits.length)
  let left = one.parts.room - fixed

  const kept: ActionName[] = []
  for (const hit of hits) {
    const cost = actionBlock(hit).length + 1
    // Passed over rather than stopped at: the list is ranked, and one long block is no reason to
    // drop every shorter one behind it.
    if (cost > left) continue
    left -= cost
    kept.push(hit.name)
  }

  return briefingOf({
    ...withParts(one, { loaded: loadedWith(loaded, kept) }),
    found: foundBlock(query, hits.length, kept.length),
  })
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
