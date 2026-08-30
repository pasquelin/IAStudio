import { refused, type ActionOutcome } from '@shared/domain/assistant'
import {
  blankCard,
  CONTEXT_CARDS_MAX,
  withCard,
  withoutCard,
  type ContextCard,
} from '@shared/domain/projectContext'
import { newId } from '@/helpers/ids'
import { useProjectContext } from '@/stores/projectContext'
import type { ActionHandlers } from './actionHandler'
import { boolOf, textOf } from './actionInputs'

/** The project's context, driven from outside. Every gesture stores the whole list. */

const unreadable = (trouble: string): string =>
  `this project's context file reads "${trouble}", so nothing may be written over it — context.read answers what the studio could make of it`

const noCard = (id: string): string =>
  `no context card "${id}" in this project — context.read answers the cards it holds, each with its id`

const NOT_STORED =
  'the context was not written into the project folder — the journal holds why, and context.read says what stands there now'

/**
 * A card id nothing holds is refused rather than created under it: a client naming one it
 * remembers from another project would write into this one under a name of its own.
 */
async function write(input: Record<string, unknown>): Promise<ActionOutcome> {
  const { context, write: store } = useProjectContext.getState()
  if (context.trouble !== null) return refused('notAllowed', unreadable(context.trouble))

  const id = textOf(input, 'cardId')
  const held = id === null ? null : (context.cards.find(card => card.id === id) ?? null)
  if (id !== null && held === null) return refused('notFound', noCard(id))
  if (held === null && context.cards.length >= CONTEXT_CARDS_MAX)
    return refused(
      'notAllowed',
      `this project already holds ${CONTEXT_CARDS_MAX} context cards, which is all it takes — context.remove frees one first`,
    )

  const card: ContextCard = {
    ...(held ?? blankCard(newId())),
    ...('title' in input ? { title: textOf(input, 'title') ?? '' } : {}),
    ...('body' in input ? { body: textOf(input, 'body') ?? '' } : {}),
    ...('active' in input ? { active: boolOf(input, 'active') } : {}),
  }

  return (await store(withCard(context.cards, card)))
    ? { ok: true, data: card }
    : refused('failed', NOT_STORED)
}

async function remove(input: Record<string, unknown>): Promise<ActionOutcome> {
  const { context, write: store } = useProjectContext.getState()
  if (context.trouble !== null) return refused('notAllowed', unreadable(context.trouble))

  const id = textOf(input, 'cardId') ?? ''
  if (!context.cards.some(card => card.id === id)) return refused('notFound', noCard(id))

  return (await store(withoutCard(context.cards, id)))
    ? { ok: true }
    : refused('failed', NOT_STORED)
}

export const CONTEXT_HANDLERS: ActionHandlers = {
  'context.read': () => ({ ok: true, data: useProjectContext.getState().context }),
  'context.write': write,
  'context.remove': remove,
}
