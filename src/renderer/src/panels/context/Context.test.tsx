import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { noContext, type ContextCard, type ContextState } from '@shared/domain/projectContext'
import { installFakeBridge } from '@/services/fakeBridge'
import { useProject } from '@/stores/project'
import { useProjectContext } from '@/stores/projectContext'
import { Context } from './Context'

const card = (fields: Partial<ContextCard> = {}): ContextCard => ({
  id: 'one',
  title: 'World',
  body: 'A medieval forest',
  active: true,
  pictures: [],
  ...fields,
})

const OPEN = {
  path: '/projects/film',
  manifest: { version: 1, name: 'Film', createdAt: '', updatedAt: '' },
}

function panelOn(context: ContextState) {
  const writeContext = vi.fn((cards: readonly ContextCard[]) =>
    Promise.resolve({ cards, trouble: null }),
  )
  installFakeBridge({ project: { writeContext } })
  useProjectContext.setState({ context, loaded: true })
  render(<Context />)
  return writeContext
}

beforeEach(() => {
  useProject.setState({ project: OPEN, known: true })
  useProjectContext.setState({ context: noContext(), loaded: true })
})

describe('the context panel', () => {
  it('asks for a project when none is open', () => {
    useProject.setState({ project: null, known: true })
    panelOn(noContext())

    expect(screen.getByText(/Ouvrez un projet/)).toBeTruthy()
  })

  it('offers a way in when the project carries nothing yet', () => {
    panelOn(noContext())

    expect(screen.getByText(/Décrivez une fois/)).toBeTruthy()
  })

  // The `+` of the title row is a glyph a first-time reader has no reason to have looked at, and
  // the sentence above is where they are: the way in belongs beside it.
  it('makes the first card from the empty screen itself', async () => {
    const writeContext = panelOn(noContext())

    await userEvent.click(screen.getByRole('button', { name: 'Créer une première fiche' }))

    expect(writeContext).toHaveBeenCalledWith([
      { id: expect.any(String), title: '', body: '', active: true, pictures: [] },
    ])
  })

  /**
   * An unread context and an empty one are the same value, and the button rewrites the file
   * whole: offered a moment too early, one click replaces a project's real cards with a blank.
   */
  it('offers nothing to click before the file has answered', () => {
    useProjectContext.setState({ context: noContext(), loaded: false })
    render(<Context />)

    expect(screen.queryByRole('button')).toBeNull()
  })

  it('offers no way in while the file is one this build will not touch', () => {
    panelOn({ cards: [], trouble: 'unreadable' })

    expect(screen.queryByRole('button', { name: 'Créer une première fiche' })).toBeNull()
  })

  it('turning a card off takes it out of what is sent, and keeps its text', async () => {
    const writeContext = panelOn({ cards: [card()], trouble: null })

    await userEvent.click(screen.getByRole('checkbox'))

    expect(writeContext).toHaveBeenCalledWith([card({ active: false })])
  })

  it('stores an edited card once the field is left, not on every letter', async () => {
    const writeContext = panelOn({ cards: [card()], trouble: null })
    const body = screen.getByRole('textbox', { name: /Ce que cette fiche/ })

    await userEvent.type(body, '!')
    expect(writeContext).not.toHaveBeenCalled()

    await userEvent.tab()
    expect(writeContext).toHaveBeenCalledWith([card({ body: 'A medieval forest!' })])
  })

  /**
   * The two troubles ask for opposite things, and the panel is the only place that says which:
   * one wants the file repaired, the other the studio updated.
   */
  it('says which trouble left the file untouched', () => {
    panelOn({ cards: [], trouble: 'too-new' })

    expect(screen.getByText(/version plus récente/)).toBeTruthy()
  })
})
