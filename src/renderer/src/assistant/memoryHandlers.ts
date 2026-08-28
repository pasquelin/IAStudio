import { refused, type ActionOutcome } from '@shared/domain/assistant'
import {
  MEMORY_PAGE,
  MEMORY_TYPES,
  type Memory,
  type MemoryDraft,
  type MemoryRef,
  type MemoryType,
} from '@shared/domain/assistantMemory'
import { getBridge } from '@/services/bridge'
import type { ActionHandlers } from './actionHandler'
import { numberOf, textOf } from './actionInputs'

/**
 * What the assistant has learned, driven from outside — the project's memory alone.
 *
 * 🛑 Never the machine's own. Promoting something a project taught into what the person is like
 * is a gesture they make in Réglages ▸ Mémoire; a client that could do it would write one
 * project's habits into every other.
 */

/** A memory answered outward: the summary and its id, never the whole row. */
const found = (one: Memory): { id: string; type: MemoryType; summary: string } => ({
  id: one.id,
  type: one.type,
  summary: one.summary,
})

const isType = (value: string): value is MemoryType => MEMORY_TYPES.some(one => one === value)

async function recall(input: Record<string, unknown>): Promise<ActionOutcome> {
  const query = textOf(input, 'query')
  if (query === null) return refused('badInput')

  const memories = await getBridge()?.memory.list('project', {
    text: query,
    limit: Math.min(numberOf(input, 'limit') ?? 10, MEMORY_PAGE),
  })

  // No project open answers an empty list rather than a refusal: a studio on its home screen has
  // learned nothing, which is not a failure.
  return { ok: true, data: { memories: (memories ?? []).map(found) } }
}

async function read(input: Record<string, unknown>): Promise<ActionOutcome> {
  const id = textOf(input, 'memoryId')
  if (id === null) return refused('badInput')

  const memory = await getBridge()?.memory.read('project', id)
  return memory ? { ok: true, data: memory } : refused('notFound')
}

async function write(input: Record<string, unknown>): Promise<ActionOutcome> {
  const type = textOf(input, 'type')
  const summary = textOf(input, 'summary')
  if (type === null || !isType(type) || summary === null) return refused('badInput')

  const file = textOf(input, 'file')
  const draft: MemoryDraft = {
    type,
    summary,
    importance: numberOf(input, 'importance') ?? 3,
    // `assistant`, never `person`: what a client wrote is not what the person typed, and the
    // panel shows the difference.
    source: { kind: 'assistant' },
    ...(textOf(input, 'body') === null ? {} : { body: textOf(input, 'body') ?? '' }),
    ...(file === null ? {} : { refs: [fileRef(file)] }),
  }

  const written = await getBridge()?.memory.remember('project', draft)
  return written ? { ok: true, data: found(written) } : refused('notAllowed')
}

/** Named so the kind is a declared type rather than an `as const` the lint refuses. */
const fileRef = (ref: string): MemoryRef => ({ kind: 'file', ref })

async function forget(input: Record<string, unknown>): Promise<ActionOutcome> {
  const id = textOf(input, 'memoryId')
  if (id === null) return refused('badInput')

  return (await getBridge()?.memory.forget('project', id)) ? { ok: true } : refused('notFound')
}

/**
 * A link is added to what the memory already holds, never instead of it: two calls linking a
 * memory to two others must leave two links.
 */
async function link(input: Record<string, unknown>): Promise<ActionOutcome> {
  const id = textOf(input, 'memoryId')
  const to = textOf(input, 'toMemoryId')
  if (id === null || to === null) return refused('badInput')

  const held = await getBridge()?.memory.read('project', id)
  if (!held) return refused('notFound')
  if (held.links.includes(to)) return { ok: true }

  const amended = await getBridge()?.memory.amend('project', id, {
    links: [...held.links, to],
  })
  return amended ? { ok: true } : refused('failed')
}

export const MEMORY_HANDLERS: ActionHandlers = {
  'memory.recall': recall,
  'memory.read': read,
  'memory.write': write,
  'memory.forget': forget,
  'memory.link': link,
}
