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
  useProjectContext.setState({ context })
  render(<Context />)
  return writeContext
}

beforeEach(() => {
  useProject.setState({ project: OPEN, known: true })
  useProjectContext.setState({ context: noContext() })
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
