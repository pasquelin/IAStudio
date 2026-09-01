import type { AssetGeneration } from './asset'
import type { FieldDescriptor } from './model'

/**
 * What a project is ABOUT — written once, added to everything generated in it.
 *
 * Cards rather than named rubrics: a novelist, an architect and a game studio describe a world in
 * entirely different words, and any set of fields this file could name would be wrong for two of
 * the three. A card is a title its author chose and a text they wrote.
 *
 * Read by both sides, and that is the point: the renderer composes it to SHOW what a generation
 * will carry, the main process composes it to ADD it. One function, so the preview cannot drift
 * from what is sent.
 */

export const CONTEXT_VERSION = 1

export const CONTEXT_CARDS_MAX = 24
export const CONTEXT_TITLE_MAX = 60

/**
 * 🛑 Bounded so that ONE card written to the maximum still fits `CONTEXT_COMPOSED_MAX`, title and
 * separator included: at 600 a card the field itself accepted could never be sent, and the panel
 * said « 0 / 600 » about text plainly on screen.
 */
export const CONTEXT_BODY_MAX = 500

/** Pinned pictures per card. */
export const CONTEXT_PICTURES_MAX = 4

/**
 * How much context may travel, whatever the cards add up to — and the bound is the MODEL, not the
 * transport. A CLIP text encoder reads 77 tokens, some three hundred characters, and drops the
 * rest without a word; a context of thousands would silently push the subject out of the prompt.
 *
 * One figure for both readers, so the preview a person sees is what the assistant gets too.
 */
export const CONTEXT_COMPOSED_MAX = 600

export type ContextCard = {
  id: string
  title: string
  body: string
  /** An off card keeps its text and adds nothing — how one is set aside without losing it. */
  active: boolean
  /** Asset ids of this project, in the order they were pinned. */
  pictures: string[]
}

export type ProjectContext = {
  version: number
  cards: ContextCard[]
}

/**
 * Why there are no cards when a file says otherwise. The two ask for opposite things — repair the
 * file, or update the studio — so they are not one `null`.
 */
export type ContextTrouble = 'unreadable' | 'too-new'

/** What a window holds: the cards, and the reason there are none when there should be. */
export type ContextState = {
  cards: readonly ContextCard[]
  trouble: ContextTrouble | null
}

/**
 * A project with no file of its own, and a window that has not asked yet — the two are the same
 * value, so anything OFFERING to write the file whole must read `loaded` before it is drawn.
 */
export function noContext(): ContextState {
  return { cards: [], trouble: null }
}

/**
 * Whether the project's context joins this one shot.
 *
 * A union rather than a boolean, and deliberately: an absent `withContext?: boolean` would have to
 * read as `true`, which nobody reads correctly. Absent here is `apply`, and it is written down.
 */
export type ContextUse = 'apply' | 'skip'
export const CONTEXT_USES: readonly ContextUse[] = ['apply', 'skip']

/**
 * The text the active cards make. The bound counts the CARDS, not the fixed line above them, so
 * the counter on screen says what its reader wrote.
 *
 * Cards are dropped from the END and whole: half a card — « avoid: concrete, neon, mod » — reads
 * as an instruction nobody wrote. The title travels with the body, because a card called « avoid »
 * means the opposite of its own text without it.
 *
 * The heading is English and literal, as the assistant's briefing is: a prompt is code, and one
 * put in a translation bundle invites someone to translate the one thing that must not move.
 */
export function composedContext(cards: readonly ContextCard[]): string {
  const kept = keptBlocks(cards).blocks

  return kept.length === 0 ? '' : ['Project context —', ...kept].join('\n')
}

/**
 * What the bound actually counts — the cards, without the fixed line above them.
 *
 * Exported because the panel's counter used `composedContext(...).length` and so read seventeen
 * characters over: « 601 / 600 » about a context nothing had truncated.
 */
export function sentLength(cards: readonly ContextCard[]): number {
  return keptBlocks(cards).length
}

/**
 * How many cards are ON, carry text, and still do not travel.
 *
 * Asked because the bound is otherwise SILENT: a card left on that says nothing to any model is
 * the defect this whole panel exists to prevent, and the counter alone cannot say it.
 */
export function droppedCards(cards: readonly ContextCard[]): number {
  return keptBlocks(cards).dropped
}

/**
 * Cards are taken in ORDER and dropped from the first that does not fit: stepping over a long
 * card to reach a short one would send a context in an order nobody sees on screen.
 */
function keptBlocks(cards: readonly ContextCard[]): {
  blocks: string[]
  length: number
  dropped: number
} {
  const blocks: string[] = []
  let length = 0
  let dropped = 0

  for (const card of cards) {
    if (!card.active) continue

    const block = blockOf(card)
    if (block.length === 0) continue
    // The newline a block adds is part of what it costs — and the FIRST one adds none. Counted
    // for it too, a card written to the maximum missed the bound by exactly one character.
    const cost = blocks.length === 0 ? block.length : block.length + 1
    if (dropped > 0 || length + cost > CONTEXT_COMPOSED_MAX) {
      dropped += 1
      continue
    }

    length += cost
    blocks.push(block)
  }

  return { blocks, length, dropped }
}

/**
 * Which field of a model holds the prompt, by the CONTRACT and never by name.
 *
 * `promptSpark` is what `translateSchema` marks. Guessing by name is how the negative prompt is
 * recognised (`FOLDED`, in `main/provider/schema.ts`), and that is a documented blind spot — a
 * context landing in a negative prompt would ask for the opposite of itself.
 */
export function promptKeyOf(fields: readonly FieldDescriptor[]): string | undefined {
  return fields.find(field => field.kind === 'longText' && field.promptSpark === true)?.key
}

/** The two halves of one prompt: what the person typed, and what was sent in its place. */
export type AuthoredPrompt = {
  written: string
  sent: string
}

export type ContextualBody = {
  body: Record<string, unknown>
  /** Absent when nothing was added, which is most generations. */
  authored: AuthoredPrompt | null
}

/**
 * The body as it leaves, the written words first and the context under them.
 *
 * First because that is the intent the model should weigh most, and because what a model truncates
 * is the tail — so what falls off is the world, never the subject.
 *
 * Untouched, silently, in three ordinary cases: nothing to add, a model with no prompt field at all
 * (an upscale, a conversion, a mesh made from a picture), and a prompt nobody wrote — a context is
 * a modifier, not a subject.
 */
export function bodyWithContext(
  body: Record<string, unknown>,
  fields: readonly FieldDescriptor[],
  context: string,
): ContextualBody {
  const key = promptKeyOf(fields)
  if (context.length === 0 || key === undefined) return { body, authored: null }

  const value = body[key]
  const written = typeof value === 'string' ? value.trim() : ''
  if (written.length === 0) return { body, authored: null }

  const sent = `${written}\n\n${context}`
  return { body: { ...body, [key]: sent }, authored: { written, sent } }
}

/**
 * A recipe told what its author actually wrote.
 *
 * The catalogue keeps the WRITTEN prompt: it is what names the file, what the inspector shows and
 * what full-text search has to match — an index of the same two hundred characters on every row
 * answers every query and helps with none.
 *
 * `params` is swept by identity because the API echoes back the exact string it was handed, and
 * under whichever key the model names — so a « regenerate » reopens the form on what was typed,
 * and the context is not stacked on itself at every replay.
 *
 * 🛑 The angle it cannot see: an API that NORMALISED what it echoes — trimming, folding newlines —
 * fails the identity and leaves `params` on the sent prompt, so a replay would stack the context.
 * `prompt` below is set outright, so the NAME and full-text search are right either way.
 */
export function withAuthoredPrompt(
  generation: AssetGeneration,
  authored: AuthoredPrompt,
): AssetGeneration {
  const params: Record<string, unknown> = {}
  for (const [key, value] of Object.entries(generation.params)) {
    params[key] = value === authored.sent ? authored.written : value
  }

  return { ...generation, prompt: authored.written, params }
}

/** The pictures the active cards pin, in order, without a repeat. */
export function contextPictures(cards: readonly ContextCard[]): readonly string[] {
  const pinned = new Set<string>()

  for (const card of cards) {
    if (!card.active) continue
    for (const id of card.pictures) pinned.add(id)
  }

  return [...pinned]
}

/**
 * The three ways a list of cards changes, written once: the panel and the MCP handlers both drive
 * the same list, and two spellings of « replace this one » are two behaviours waiting to differ.
 *
 * `withCard` adds or replaces on the id, so a caller never has to know which it is doing.
 */
export function withCard(cards: readonly ContextCard[], card: ContextCard): ContextCard[] {
  return cards.some(held => held.id === card.id)
    ? cards.map(held => (held.id === card.id ? card : held))
    : [...cards, card]
}

export function withoutCard(cards: readonly ContextCard[], id: string): ContextCard[] {
  return cards.filter(card => card.id !== id)
}

/** A card with nothing in it yet. The id comes from the caller: only it knows how to mint one. */
export function blankCard(id: string): ContextCard {
  return { id, title: '', body: '', active: true, pictures: [] }
}

/** A card with nothing in it adds nothing, whether it is on or not. */
const blockOf = (card: ContextCard): string => {
  const title = card.title.trim()
  const body = card.body.trim()

  if (body.length === 0) return ''
  return title.length === 0 ? body : `${title}: ${body}`
}

/**
 * What a first card can be started FROM, for someone facing an empty panel with no idea what a
 * context is for. Keys, never words: these are shown on screen.
 *
 * Three, and deliberately not a schema: they are a way in, and a card started from one is renamed
 * and rewritten like any other. Nothing anywhere reads these ids back.
 */
export type ContextTemplate = {
  id: string
  titleKey: string
  bodyKey: string
}

export const CONTEXT_TEMPLATES: readonly ContextTemplate[] = [
  { id: 'world', titleKey: 'context.templateWorld', bodyKey: 'context.templateWorldBody' },
  { id: 'look', titleKey: 'context.templateLook', bodyKey: 'context.templateLookBody' },
  { id: 'avoid', titleKey: 'context.templateAvoid', bodyKey: 'context.templateAvoidBody' },
]
