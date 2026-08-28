import { refused, type ActionOutcome } from '@shared/domain/assistant'
import {
  anchorsOf,
  MEMORY_PAGE,
  MEMORY_TYPES,
  type Memory,
  type MemoryDraft,
  type MemoryRef,
  type MemoryType,
} from '@shared/domain/assistantMemory'
import { memoryBridge } from '@/services/bridge'
import { frontDocument } from './documentTargets'
import type { ActionHandlers } from './actionHandler'
import { numberOf, textOf } from './actionInputs'

/**
 * What the assistant has learned, driven from outside — the project's memory alone.
 *
 * 🛑 Never the machine's own. Promoting something a project taught into what the person is like
 * is a gesture they make in Réglages ▸ Mémoire; a client that could do it would write one
 * project's habits into every other.
 *
 * 🛑 Straight to the bridge, where `contextHandlers` goes through its store — and that is why:
 * the store holds a `scope` the panel moves, so borrowing it would write into the machine's
 * memory whenever the window had been left on « Global ».
 */

/**
 * A memory answered outward.
 *
 * 🛑 Enough to be USEFUL in one round trip, which is what the memory being a resource rather than
 * a briefing block requires: the summary answers, `body` says whether `memory.read` is worth
 * asking for, and `importance` is what ranks two answers that both fit. `[M]` 137 characters of
 * JSON a memory against 89 for the id and summary alone — the whole row would be 340.
 */
const found = (one: Memory): MemoryFound => ({
  id: one.id,
  type: one.type,
  summary: one.summary,
  importance: one.importance,
  hasBody: one.body.length > 0,
})

type MemoryFound = {
  id: string
  type: MemoryType
  summary: string
  importance: number
  /** Whether anything stands behind the summary. `false` makes `memory.read` a wasted call. */
  hasBody: boolean
}

const isType = (value: string): value is MemoryType => MEMORY_TYPES.some(one => one === value)

/**
 * 🛑 `recall` and not `list`, and the difference is the whole point: `list` is a FILTER, so it
 * demanded every word of « à quoi sert le script CameraRig ? » of a single memory. This is the
 * one call that embeds the question and ranks by meaning as well as by words.
 */
async function recall(input: Record<string, unknown>): Promise<ActionOutcome> {
  const query = textOf(input, 'query')
  if (query === null) return refused('badInput')

  const memories = await memoryBridge()?.recall('project', {
    text: query,
    // 🛑 What is in front travels with the question: `anchored` is the strongest voice of the
    // ranking, and nothing else in the studio fills it — a recall without this scores on words
    // and meaning alone, and the weight written as « it is not a guess » never answers.
    refs: anchorsOf(frontDocument()),
    limit: Math.min(numberOf(input, 'limit') ?? 10, MEMORY_PAGE),
  })

  // No project open answers an empty list rather than a refusal: a studio on its home screen has
  // learned nothing, which is not a failure.
  return { ok: true, data: { memories: (memories ?? []).map(found) } }
}

async function read(input: Record<string, unknown>): Promise<ActionOutcome> {
  const id = textOf(input, 'memoryId')
  if (id === null) return refused('badInput')

  const memory = await memoryBridge()?.read('project', id)
  return memory ? { ok: true, data: memory } : refused('notFound')
}

async function write(input: Record<string, unknown>): Promise<ActionOutcome> {
  const type = textOf(input, 'type')
  const summary = textOf(input, 'summary')
  if (type === null || !isType(type) || summary === null) return refused('badInput')

  const file = textOf(input, 'file')
  const body = textOf(input, 'body')
  const draft: MemoryDraft = {
    type,
    summary,
    importance: numberOf(input, 'importance') ?? 3,
    // `assistant`, never `person`: what a client wrote is not what the person typed, and the
    // panel shows the difference.
    source: { kind: 'assistant' },
    ...(body === null ? {} : { body }),
    ...(file === null ? {} : { refs: [fileRef(file)] }),
  }

  const written = await memoryBridge()?.remember('project', draft)
  return written ? { ok: true, data: found(written) } : refused('notAllowed')
}

/** Named so the kind is a declared type rather than an `as const` the lint refuses. */
const fileRef = (ref: string): MemoryRef => ({ kind: 'file', ref })

async function forget(input: Record<string, unknown>): Promise<ActionOutcome> {
  const id = textOf(input, 'memoryId')
  if (id === null) return refused('badInput')

  return (await memoryBridge()?.forget('project', id)) ? { ok: true } : refused('notFound')
}

/**
 * A link is added to what the memory already holds, never instead of it: two calls linking a
 * memory to two others must leave two links.
 */
async function link(input: Record<string, unknown>): Promise<ActionOutcome> {
  const id = textOf(input, 'memoryId')
  const to = textOf(input, 'toMemoryId')
  if (id === null || to === null) return refused('badInput')

  // 🛑 ONE call, and the union is computed in the store's write queue. Read-then-write across the
  // boundary lost whatever the other window — or a merge — had linked in between.
  const amended = await memoryBridge()?.amend('project', id, { linkTo: [to] })
  return amended ? { ok: true } : refused('notFound')
}

export const MEMORY_HANDLERS: ActionHandlers = {
  'memory.recall': recall,
  'memory.read': read,
  'memory.write': write,
  'memory.forget': forget,
  'memory.link': link,
}
