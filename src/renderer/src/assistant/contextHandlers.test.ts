import { beforeEach, describe, expect, it, vi } from 'vitest'
import { commitmentOfCall } from '@shared/domain/assistant'
import { noContext, type ContextCard } from '@shared/domain/projectContext'
import { installFakeBridge } from '@/services/fakeBridge'
import { useProjectContext } from '@/stores/projectContext'
import { CONTEXT_HANDLERS } from './contextHandlers'

const card = (fields: Partial<ContextCard> = {}): ContextCard => ({
  id: 'one',
  title: 'World',
  body: 'A medieval forest',
  active: true,
  pictures: [],
  ...fields,
})

const run = (name: 'context.read' | 'context.write' | 'context.remove', input = {}) =>
  CONTEXT_HANDLERS[name]?.(input)

beforeEach(() => {
  useProjectContext.setState({ context: { cards: [card()], trouble: null } })
})

describe('driving the project context from outside', () => {
  it('answers the cards the project holds', async () => {
    expect(await run('context.read')).toMatchObject({ ok: true, data: { cards: [card()] } })
  })

  it('adds a card the project did not have', async () => {
    const writeContext = vi.fn((cards: readonly ContextCard[]) =>
      Promise.resolve({ cards, trouble: null }),
    )
    installFakeBridge({ project: { writeContext } })

    expect(await run('context.write', { title: 'Look', body: 'Oil paint' })).toMatchObject({
      ok: true,
    })
    expect(writeContext.mock.calls[0]?.[0]).toHaveLength(2)
  })

  /**
   * A client naming a card it remembers from another project would otherwise write into this one
   * under a name of its own — and a card nobody can find is not a card to create silently.
   */
  it('refuses a card id this project does not hold', async () => {
    expect(await run('context.remove', { cardId: 'elsewhere' })).toEqual({
      ok: false,
      refusal: 'notFound',
    })
  })

  it('refuses to touch a file it could not read', async () => {
    useProjectContext.setState({ context: { cards: [], trouble: 'unreadable' } })

    expect(await run('context.write', { title: 'Look' })).toEqual({
      ok: false,
      refusal: 'notAllowed',
    })
  })

  /** Rewriting somebody's sentence asks first; turning a card off does not — it undoes on a click. */
  it('asks before it rewrites a card, and not before it turns one off', () => {
    expect(commitmentOfCall('context.write', { cardId: 'one', body: 'Rain' })).toBe('files')
    expect(commitmentOfCall('context.write', { cardId: 'one', active: false })).toBe('none')
  })
})

describe('a project with no context at all', () => {
  it('answers no cards rather than refusing', async () => {
    useProjectContext.setState({ context: noContext() })

    expect(await run('context.read')).toMatchObject({ ok: true, data: { cards: [] } })
  })
})
