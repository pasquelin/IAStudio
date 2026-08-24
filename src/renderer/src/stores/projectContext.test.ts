import { beforeEach, describe, expect, it, vi } from 'vitest'
import {
  noContext,
  withCard,
  type ContextCard,
  type ContextState,
} from '@shared/domain/projectContext'
import { installFakeBridge } from '@/services/fakeBridge'
import { useProjectContext } from './projectContext'

const card = (fields: Partial<ContextCard> = {}): ContextCard => ({
  id: 'one',
  title: 'World',
  body: 'A medieval forest',
  active: true,
  pictures: [],
  ...fields,
})

const state = () => useProjectContext.getState()

describe('the context, as the window holds it', () => {
  beforeEach(() => {
    useProjectContext.setState({ context: noContext() })
  })

  it('reads the file back and follows what another window writes', async () => {
    const onContextChanged = vi.fn<(callback: (context: ContextState) => void) => () => void>(
      () => () => {},
    )
    installFakeBridge({
      project: {
        readContext: () => Promise.resolve({ cards: [card()], trouble: null }),
        onContextChanged,
      },
    })

    await state().connect()

    expect(state().context.cards).toEqual([card()])
    expect(onContextChanged).toHaveBeenCalled()
  })

  /**
   * 🛑 Two gestures in a row each compose from the list they read. Before the store held the first
   * one, the second read the list from before it and stored that — the edit in between was gone.
   */
  it('lets a second edit build on the first, before the disk has answered', async () => {
    const stored: (readonly ContextCard[])[] = []
    installFakeBridge({
      project: {
        writeContext: cards => {
          stored.push(cards)
          return Promise.resolve({ cards, trouble: null })
        },
      },
    })
    useProjectContext.setState({ context: { cards: [card()], trouble: null } })

    const typing = state().write([card({ body: 'A misty forest' })])
    // What the row does on a click: it composes from the card the store is showing right now.
    const showing = state().context.cards[0] ?? card()
    await state().write(withCard(state().context.cards, { ...showing, active: false }))
    await typing

    expect(stored[1]).toEqual([card({ body: 'A misty forest', active: false })])
  })

  // The one refusal that reaches here is a file this build will not overwrite. Dropping the cards
  // on the floor would leave the panel blank beside a file that still holds them.
  it('keeps what it is showing when the file refuses to be written over', async () => {
    useProjectContext.setState({ context: { cards: [card()], trouble: 'unreadable' } })
    installFakeBridge({
      project: { writeContext: () => Promise.reject(new Error('locked')) },
    })

    expect(await state().write([card({ title: 'Another' })])).toBe(false)
    expect(state().context.cards).toEqual([card()])
  })
})
