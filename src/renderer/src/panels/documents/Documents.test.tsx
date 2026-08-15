import { fireEvent, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { DocumentDescriptor } from '@shared/domain/document'
import { fakeMenu } from '@/helpers/menu-fixtures'
import { installFakeBridge } from '@/services/fake-bridge'
import { useDocuments } from '@/stores/documents'
import { useProject } from '@/stores/project'
import { Documents } from './Documents'

vi.mock('@/app/dockview-api', () => ({ openDocument: vi.fn() }))

const POSTER: DocumentDescriptor = {
  id: 'a',
  kind: 'image',
  title: 'Poster',
  workspace: 'image',
  fileName: 'Poster.img',
}

/** Reset per case, as every menu-raising suite of this studio does. */
let menu = fakeMenu()

beforeEach(() => {
  vi.clearAllMocks()
  menu = fakeMenu()
  installFakeBridge({ menu: menu.bridge })
  useDocuments.setState({ documents: {}, stored: [POSTER], activeId: null })
  useProject.setState({
    project: {
      path: '/projects/demo',
      manifest: { version: 1, name: 'demo', createdAt: '', updatedAt: '' },
    },
  })
})

/**
 * The flat list of what the project holds to open — the question the home asks. Its neighbour
 * the Explorer answers a different one: it walks the folder as a tree, where a document is one
 * file among many. The two were the same panel until the Explorer became a file browser.
 */
describe('the documents panel', () => {
  it('lists the documents of the project, flat', () => {
    render(<Documents />)

    expect(screen.getByText('Poster')).toBeInTheDocument()
  })

  // The widget announces the name of the panel it is in, not the one it was written for.
  it('announces its list under the name the home gives it', () => {
    render(<Documents />)

    expect(screen.getByRole('list', { name: 'Vos documents' })).toBeInTheDocument()
    expect(screen.queryByRole('list', { name: 'Explorateur' })).not.toBeInTheDocument()
  })

  // A closed document is unreachable by the tabs; this list is where it is found again. The
  // cell carries the gesture, not the text inside it — that is `Collection`'s doing.
  it('opens a document on a double-click, as every list of the studio does', async () => {
    const { openDocument } = await import('@/app/dockview-api')
    const { container } = render(<Documents />)

    const cell = container.querySelector('[data-cell="0"]')
    expect(cell).not.toBeNull()
    if (cell) fireEvent.doubleClick(cell)

    expect(openDocument).toHaveBeenCalledWith(POSTER)
  })

  /**
   * The mark of "open", which is what tells this list from a list of files: a document already
   * in front of you is one you reach by its tab, not by opening it again.
   */
  it('marks the documents a tab is already showing', () => {
    useDocuments.setState({ documents: { a: POSTER }, stored: [POSTER], activeId: 'a' })
    render(<Documents />)

    expect(screen.getByText('Ouvert')).toBeInTheDocument()
  })

  /**
   * The name is read here as much as in the explorer and on the tab, so it is changed here too:
   * a gesture offered by one list and not by the one beside it is a gesture nobody finds twice.
   */
  it('renames a document where it is listed', async () => {
    const rename = vi.fn(() => Promise.resolve({ ...POSTER, title: 'Affiche' }))
    // `list` too: the panel relists on mount, and a bridge that answers nothing empties it.
    installFakeBridge({
      documents: { list: () => Promise.resolve([POSTER]), rename },
      menu: menu.bridge,
    })
    menu.picks('Renommer')
    const { container } = render(<Documents />)

    const cell = container.querySelector('[data-cell="0"]')
    expect(cell).not.toBeNull()
    if (cell) fireEvent.contextMenu(cell)

    const field = await screen.findByRole('textbox', { name: 'Nom du document' })
    await userEvent.clear(field)
    await userEvent.type(field, 'Affiche{Enter}')

    await vi.waitFor(() => expect(rename).toHaveBeenCalledWith('a', 'image', 'Affiche'))
  })

  // An open folder that holds nothing yet is not the same silence as no folder at all.
  it('tells an empty project from no project at all', () => {
    useDocuments.setState({ documents: {}, stored: [], activeId: null })
    render(<Documents />)

    expect(screen.getByText(/ne contient encore aucun document/)).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Ouvrir un projet' })).not.toBeInTheDocument()
  })

  /**
   * A panel standing under a rail icon with nothing in it reads as a bug. With no folder open
   * there is nothing to list at all, so it offers the two gestures that fix that.
   */
  it.each([
    ['Ouvrir un projet', 'openPicked'],
    ['Créer un projet', 'createPicked'],
  ])('offers %s as a way out when no project is open', async (label, gesture) => {
    const picked = vi.fn(() => Promise.resolve())
    useProject.setState({ project: null, known: true, [gesture]: picked })
    render(<Documents />)

    await userEvent.click(screen.getByRole('button', { name: label }))

    expect(picked).toHaveBeenCalled()
  })

  /**
   * The studio reopens the last project on launch, and `project` is `null` until the main
   * process says so. Offering to create one during that wait tells someone who already has a
   * project that they have none — which is what this panel did before it read `NoProject`.
   */
  it('waits for the answer rather than calling the absence a fact', () => {
    useProject.setState({ project: null, known: false })
    render(<Documents />)

    expect(screen.queryByRole('button', { name: 'Créer un projet' })).not.toBeInTheDocument()
  })
})
