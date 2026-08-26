import {
  actionsReaching,
  DISCOVERY_ACTION,
  familyOfAction,
  findActions,
  type AssistantThought,
  type ActionField,
  type ActionName,
  type AssistantAction,
  HISTORY_MAX,
} from '@shared/domain/assistant'
import type { Target } from '@shared/domain/target'
import { englishText } from '@shared/i18n'
import { linesWithin } from './studioState'

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

function actionBlock(action: AssistantAction): string {
  const lines = [`  ${action.name} — ${englishText(action.descriptionKey)}`]
  for (const field of action.fields) lines.push(fieldLine(field))
  return lines.join('\n')
}

/**
 * The catalogue, with a heading each time the family changes.
 *
 * 🛑 The WIDE share alone: 230 actions read flat is a list a model gives up on — « nomme les
 * mises de côté » reached `favorites.list` on the bench pass of 2026-08-26. The short share pays
 * 8 000 characters for eleven actions and can afford no heading at all.
 */
function cataloguePrinted(actions: readonly AssistantAction[], grouped = false): string {
  const lines: string[] = []
  let family = ''

  for (const action of actions) {
    const next = familyOfAction.get(action.name) ?? ''
    if (grouped && next !== family) lines.push(`  [${next}]`)
    family = next
    lines.push(actionBlock(action))
  }

  return lines.join('\n')
}

const namesOf = (actions: readonly AssistantAction[]): ReadonlySet<ActionName> =>
  new Set(actions.map(action => action.name))

/** One share of the registry, and everything a briefing needs of it. */
type Share = {
  readonly text: string
  readonly allowed: ReadonlySet<ActionName>
}

const shareOf = (actions: readonly AssistantAction[], grouped = false): Share => ({
  text: cataloguePrinted(actions, grouped),
  allowed: namesOf(actions),
})

/** 🛑 Held for the process: the whole registry is 69 000 characters and 225 bundle lookups. */
let wholeHeld: Share | null = null
let shortHeld: Share | null = null

const wholeShare = (): Share =>
  // Dropped from the wide list on purpose: a model shown everything has nothing left to find.
  (wholeHeld ??= shareOf(
    actionsReaching('mcp').filter(action => action.name !== DISCOVERY_ACTION),
    true,
  ))

/**
 * The spoken vocabulary, MINUS the discovery action: `FIND_RULE` already spells that call whole,
 * and a block describing it a second time is 165 characters the sentence pays for. It stays in
 * `allowed`, because being unlisted is not the same as being refused.
 */
const shortShare = (): Share =>
  (shortHeld ??= {
    ...shareOf(actionsReaching('both').filter(one => one.name !== DISCOVERY_ACTION)),
    allowed: namesOf(actionsReaching('both')),
  })

/**
 * The shape the answer has to take.
 *
 * Stated twice — as a sentence and as an example — because the one thing this whole file exists
 * to obtain is a parseable object, and the cheapest model on the list is the one most likely to
 * wrap it in prose if only told once.
 */
const FORMAT = [
  'Answer with one JSON object and nothing else. No prose around it, no code fence.',
  'The object has exactly two keys:',
  '  "say": a short sentence for the person, in their language. May be empty.',
  '  "calls": a list of actions to run, in order. May be empty.',
  'Each call is {"action": "<name from the catalogue>", "input": {<the fields above>}}.',
  // 🛑 A LITERAL id: the example spelled `"<the armed model>"` and the model copied the shape —
  // twenty-three calls over five passes carried `<shotId>` or `<path found>` where a value goes.
  'Example: {"say":"Making an image.","calls":[{"action":"generator.prepare",',
  '"input":{"family":"image","modelId":"flux.1-dev","parameters":{"prompt":"a bicycle"}}},',
  '{"action":"generator.submit","input":{}}]}',
].join('\n')

const RULES = [
  '  - Only use actions from the catalogue below. Never invent one.',
  '  - One request often needs several calls, in order. Carry it to its end.',
  '  - Ask rather than act halfway: no calls, and the question in "say".',
  '  - generator.prepare fills the form and stops. generator.submit sends it and spends credits.',
  '  - If nothing in the catalogue fits, return no calls and say so in "say".',
  // The state below is what the person is looking at. Written as a rule rather than left to be
  // inferred: a model handed a space and a document still opened a second one for the subject of
  // the sentence, which is where "make me a bicycle" became a document named Bicycle.
  '  - Act on what is in front of the person. Only make a document when asked for a new one.',
]

/**
 * 🛑 The rules that NAME an action of the wide catalogue, and are therefore given only to a door
 * that holds it.
 *
 * Told to a narrow door, they are worse than useless: `parseReply` refuses a reply WHOLE the
 * moment one call names an action the briefing did not show, so a model obeying "list the folder"
 * with `files.list` loses its entire answer — twice, since the retry only complains about JSON —
 * and the turn dies as "I did not manage to answer that one", two billed round trips spent.
 * `FIND_RULE` does not rescue it either: `discoveryIn` only reads a reply whose SINGLE call is
 * `actions.find`.
 *
 * They cost nothing here: a door shown the whole registry has room measured in the hundred
 * thousands, where the short share lives against 8 000.
 */
const WIDE_RULES = [
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
  '  - Several files match? Choose none: name them in "say" and ask which.',
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
  '    project catalogue. assets.search with generated finds it; nothing else announces it.',
  // Twice over, a reference travelled as a PATH under a key nobody reads. The field belongs to
  // the model's own schema, and the value is an asset id.
  '  - To work FROM a picture, read model.schema first and fill the field it names with an ASSET',
  '    ID — never a path, and never a key you chose yourself.',
  // A plan that reads well and cannot run: opening the picture is what put the Image space in
  // front, and every scene call after it was refused.
  '  - Scene, image and montage actions work on the document IN FRONT, and opening a file changes',
  '    which one that is. Open what you will act on LAST, or bring it back with document.activate,',
  '    which takes its id, its path, or the title the studio shows in quotes.',
  // Narrowed to the repair alone: rule 3 above is what makes a model ask, and it must keep doing
  // so for what the person alone knows.
  '  - Never ask to be allowed to repair your OWN order: do it, and say what you did.',
  /**
   * 🛑 The five below name no action and belong here all the same: the short share runs 8 022
   * characters against a room of 8 000, so a line added there takes an action off the catalogue.
   */
  // Twelve requests died on a question the studio answers — « sur quel clip ? » to a montage
  // holding one, « quel modèle 3D ? » to a project holding two.
  '  - Rule 3 is for what the person ALONE knows. ONE thing of that kind in front of you is the',
  '    one meant, and a question about what a read would have told you is a turn spent for nothing.',
  '  - "one metre more", "half", "25% more" are RELATIVE. Read the value that stands, do the',
  '    arithmetic, write the result: every field is an absolute value, never a difference.',
  '  - Never say a thing is done unless a call in this conversation did it.',
  '  - Reading is not doing: the request is done once the change it asked for has been WRITTEN.',
  // The same call sent four times after it answered ok, one refusal collected eight times on
  // arguments that never changed. Here and not in CONTINUING, which the narrow door also shows.
  '  - A call that answered ok has HAPPENED — sending it again does it twice. A refused call is',
  '    refused again on the same arguments: change them, or do something else.',
]

/** What the short list cannot say, and how the model asks for the rest — see `answeredTurn`. */
const FIND_RULE =
  `  - Nothing in the catalogue fits? Answer with that ONE call and nothing else: ` +
  `{"action":"${DISCOVERY_ACTION}","input":{"query":"<a word for what you need>"}}.`

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
  'Answer with NO calls when the request is done, or when you need something only the person',
  'can tell you: your "say" is then what they read.',
].join('\n')

const roleWith = (rules: readonly string[]): string =>
  [
    'You drive IA Studio, a desktop application for generating images, video, 3D models,',
    'audio, textures and skyboxes. The person talks to you and you act on their behalf.',
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
  /** What the open document can be aimed at, narrowed by the window — see `target.ts`. */
  targets?: readonly Target[]
  /**
   * 🛑 How much briefing the brain about to carry it can hold — a number that belongs to the
   * BRAIN and not to this file. What the model is SHOWN of the catalogue follows from it.
   *
   * Not a ceiling on the whole: the short share plus a full project context and a full state
   * block runs to 8 232 characters against `roomFor(4096)` = 7 116, measured on 2026-08-26 —
   * a figure that moves whenever a `both` action's description does. What gives ground there is
   * the sentence (`sentenceWithin`), never the instructions.
   */
  room: number
  /**
   * What the SHORT share is budgeted against when this door refused the wide one — a fact of the
   * door, which has just disproved its own `room`. Defaults to `room`, which is right for a door
   * that was never shown the whole catalogue in the first place.
   */
  fallbackRoom?: number
}

/**
 * What the model is shown, and what an answer is then held to.
 *
 * `allowed` travels with the text because the two are one decision: `parseReply` refuses a call
 * naming an action the model was not SHOWN, and what it was shown now depends on the room.
 */
export type Briefing = {
  readonly text: string
  readonly allowed: ReadonlySet<ActionName>
  /** The same briefing with what a query found added, or nothing when there is no room to expand. */
  readonly expand: ((query: string) => Briefing) | null
  /**
   * The short share of the same parts, for a door that REFUSED this one — `BRIEFING_ROOM` is an
   * assumption about a hand-typed cloud model's window, and nothing else would degrade when the
   * assumption is wrong. `null` once it is already the short share.
   */
  readonly narrow: (() => Briefing) | null
}

/**
 * 🛑 The state block is what GIVES GROUND when the room runs out — not the sentence, which
 * `instructionFor` guarantees, and not the catalogue, without which nothing can be named.
 *
 * It has to: `instruction.test.ts` saturates the project context and the target list at once and
 * holds two thousand characters for the sentence, and the state is the one part composed from
 * names a person chose. Composed twice only when it overruns, which is not the ordinary turn.
 */
function briefingText(
  parts: BriefingParts,
  catalogue: string,
  rules: readonly string[],
  found: string,
): string {
  const state = parts.state ?? ''
  const targets = parts.targets ?? []
  const full = composed(parts, catalogue, rules, found, state, targets)
  if (full.length <= parts.room) return full

  // The state gives ground first — it is prose, and its lines are ranked from the most useful.
  const short = linesWithin(state, Math.max(0, state.length - (full.length - parts.room)))
  const trimmed = composed(parts, catalogue, rules, found, short, targets)
  if (trimmed.length <= parts.room) return trimmed

  /**
   * Then the TAIL of the target list, which is the loss the window already designed for: it ranks
   * them selection first, then the names the sentence spells, then the rest. Dropping from the
   * end is dropping what the sentence never mentioned.
   */
  const over = trimmed.length - parts.room
  return composed(parts, catalogue, rules, found, short, targetsWithin(targets, over))
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

function composed(
  parts: BriefingParts,
  catalogue: string,
  rules: readonly string[],
  found: string,
  state: string,
  targets: readonly Target[],
): string {
  // Silent when everything is served: a line saying nothing is worth no characters.
  const idle =
    parts.notReady && parts.notReady.length > 0
      ? [`No model ready for: ${parts.notReady.join(', ')}.`, '']
      : []
  // Before the catalogue rather than after it: what the project IS frames every action the model
  // might pick, where a note under the list reads as a footnote to the last one.
  const about = parts.context ? ['Project context:', parts.context, ''] : []
  const now = state ? [state, ''] : []
  // After the catalogue rather than before it: `target.select` is what these ids are for, and a
  // list read before the action that consumes them reads as facts about nothing.
  const aim =
    targets.length > 0
      ? ['Targets in the open document:', targets.map(targetLine).join('\n'), '']
      : []

  return [
    roleWith(rules),
    '',
    ...about,
    ...now,
    ...idle,
    'Catalogue:',
    catalogue,
    '',
    ...aim,
    ...(found ? [found, ''] : []),
    ...(parts.continuing ? [CONTINUING, ''] : []),
    FORMAT,
  ].join('\n')
}

/**
 * Everything but the person's sentence, sized to the room the brain has: the whole registry when
 * it fits, and the spoken vocabulary plus the way to ask for the rest when it does not. Nothing
 * here names a cloud or a runtime.
 */
export function studioBriefing(parts: BriefingParts): Briefing {
  const whole = wholeShare()
  // The catalogue alone settles it for a narrow door, and settles it without composing: Scenario
  // and every 4 096-token model would otherwise join 69 000 characters on every sentence typed.
  if (parts.room < whole.text.length) return narrowBriefing(parts)

  const wide = briefingText(parts, whole.text, [...RULES, ...WIDE_RULES], '')
  if (wide.length > parts.room) return narrowBriefing(parts)

  return { text: wide, allowed: whole.allowed, expand: null, narrow: () => narrowBriefing(parts) }
}

function narrowBriefing(declared: BriefingParts): Briefing {
  const parts = { ...declared, room: declared.fallbackRoom ?? declared.room }
  const short = shortShare()

  return {
    text: briefingText(parts, short.text, [...RULES, FIND_RULE], ''),
    allowed: short.allowed,
    // Offered once, and only from here: an expansion of an expansion is a conversation with
    // itself, paid for by the person waiting — see `expandedWith`.
    expand: query => expandedWith(parts, query),
    narrow: null,
  }
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
    state: request.state,
    targets: request.targets,
    room,
    fallbackRoom,
  })
}

const foundHeader = (query: string): string => `Also available, found for "${query}":`

const nothingFound = (query: string): string =>
  `Nothing in the catalogue matches "${query}". Say so rather than inventing an action.`

/**
 * 🛑 NOT the same sentence as `nothingFound`, and the difference is the whole point: every Ollama
 * model declares a 4 096-token window, which leaves 7 116 characters against a short briefing of
 * 7 343 with a full project context — so the room is negative and NOTHING fits. Told "nothing
 * matches", the model says so to the person, about nineteen actions that do.
 */
const noRoomFound = (query: string, hits: number): string =>
  `${hits} actions match "${query}", and this briefing has no room to describe them. ` +
  `Say so rather than guessing at one.`

function foundBlock(query: string, hits: number, kept: readonly AssistantAction[]): string {
  if (hits === 0) return nothingFound(query)
  if (kept.length === 0) return noRoomFound(query, hits)

  return [foundHeader(query), cataloguePrinted(kept)].join('\n')
}

/** The longest of the three, in characters: the room is budgeted for whichever is emitted. */
const footerRoom = (query: string, hits: number): number =>
  Math.max(foundHeader(query).length, nothingFound(query).length, noRoomFound(query, hits).length)

/**
 * The short briefing plus what one query found, cut to the room by whole ACTIONS.
 *
 * Cut by blocks rather than by characters: half a field line is an action the model cannot call
 * and cannot see is truncated, which is the one failure this whole mechanism exists to avoid.
 */
function expandedWith(parts: BriefingParts, query: string): Briefing {
  const short = shortShare()
  const hits = findActions(query).filter(action => !short.allowed.has(action.name))
  // Composed once: measuring by joining a second copy of the same 6 500 characters is the very
  // waste this file's own history records having removed.
  const fixed = briefingText(parts, short.text, RULES, '').length + footerRoom(query, hits.length)
  let left = parts.room - fixed

  const kept: AssistantAction[] = []
  for (const hit of hits) {
    const cost = actionBlock(hit).length + 1
    // Passed over rather than stopped at: the list is ranked, and one long block is no reason to
    // drop every shorter one behind it.
    if (cost > left) continue
    left -= cost
    kept.push(hit)
  }

  return {
    text: briefingText(parts, short.text, RULES, foundBlock(query, hits.length, kept)),
    allowed: new Set([...short.allowed, ...kept.map(one => one.name)]),
    expand: null,
    // An expansion is longer than the briefing that just went through, so it is the read most
    // likely to be refused for its size — and what it falls back on is that same briefing.
    narrow: () => narrowBriefing(parts),
  }
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
