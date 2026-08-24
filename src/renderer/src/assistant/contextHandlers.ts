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

/**
 * A card id nothing holds is refused rather than created under it: a client naming one it
 * remembers from another project would write into this one under a name of its own.
 */
async function write(input: Record<string, unknown>): Promise<ActionOutcome> {
  const { context, write: store } = useProjectContext.getState()
  if (context.trouble !== null) return refused('notAllowed')

  const id = textOf(input, 'cardId')
  const held = id === null ? null : (context.cards.find(card => card.id === id) ?? null)
  if (id !== null && held === null) return refused('notFound')
  if (held === null && context.cards.length >= CONTEXT_CARDS_MAX) return refused('notAllowed')

  const card: ContextCard = {
    ...(held ?? blankCard(newId())),
    ...('title' in input ? { title: textOf(input, 'title') ?? '' } : {}),
    ...('body' in input ? { body: textOf(input, 'body') ?? '' } : {}),
    ...('active' in input ? { active: boolOf(input, 'active') } : {}),
  }

  return (await store(withCard(context.cards, card))) ? { ok: true, data: card } : refused('failed')
}

async function remove(input: Record<string, unknown>): Promise<ActionOutcome> {
  const { context, write: store } = useProjectContext.getState()
  if (context.trouble !== null) return refused('notAllowed')

  const id = textOf(input, 'cardId') ?? ''
  if (!context.cards.some(card => card.id === id)) return refused('notFound')

  return (await store(withoutCard(context.cards, id))) ? { ok: true } : refused('failed')
}

export const CONTEXT_HANDLERS: ActionHandlers = {
  'context.read': () => ({ ok: true, data: useProjectContext.getState().context }),
  'context.write': write,
  'context.remove': remove,
}
