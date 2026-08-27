import { aiRoleId } from '@shared/domain/aiRole'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { installFakeBridge } from '@/services/fakeBridge'
import { useDocuments } from '@/stores/documents'
import { trackByGit } from '@/stores/git-fixtures'
import { useLayouts } from '@/stores/layouts'
import { useModels } from '@/stores/models'
import { useProject } from '@/stores/project'
import { arrangedFor } from '@/stores/tool-fixtures'
import { DEFAULT_ARRANGEMENTS, arrangementOf, useTools } from '@/stores/tools'
import { Rail } from './Rail'

const openDocument = vi.fn()
vi.mock('../dockviewApi', () => ({ openDocument: (...args: unknown[]) => openDocument(...args) }))

describe('Rail', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    installFakeBridge()
    useDocuments.setState({ documents: {} })
    useLayouts.setState({ activeWorkspace: '3d', home: false, layout: null })
    useModels.setState({ selected: {} })
    // The rail offers the history only over a folder git is tracking, and every case below is
    // about which icons the columns carry rather than about that condition.
    trackByGit()
    const stamp = '2026-08-07T10:00:00.000Z'
    useProject.setState({
      project: {
        path: '/projects/one',
        manifest: { version: 1, name: 'One', createdAt: stamp, updatedAt: stamp },
      },
    })
  })

  it('creates a document in the active workspace and opens it', async () => {
    // The naming window answers, which is what a person in front of it would do: the default
    // bridge answers `null`, and cancelling makes nothing at all.
    installFakeBridge({
      newDocument: { ask: () => Promise.resolve({ title: 'Niveau', folder: 'documents' }) },
    })
    render(<Rail side="left" />)
    await userEvent.click(screen.getByRole('button', { name: 'Nouveau document' }))

    // The document is written before it is announced, so the tab arrives a turn later.
    await waitFor(() => expect(Object.keys(useDocuments.getState().documents)).toHaveLength(1))

    const documents = Object.values(useDocuments.getState().documents)
    expect(documents[0]?.workspace).toBe('3d')
    expect(openDocument).toHaveBeenCalledWith(documents[0])
  })

  // A document is a file in a project folder: with none open there is nowhere to write it, and
  // the click would fail after the fact rather than never being offered.
  it('disables the button while no project is open', () => {
    useProject.setState({ project: null })
    render(<Rail side="left" />)
    expect(screen.getByRole('button', { name: 'Nouveau document' })).toBeDisabled()
  })

  it('carries no new-document button on the right rail', () => {
    render(<Rail side="right" />)
    expect(screen.queryByRole('button', { name: 'Nouveau document' })).not.toBeInTheDocument()
  })

  /**
   * The button makes what the surface makes. On the home a document would land in the space
   * behind it, out of sight of the screen that was asked — and the project is what the studio
   * needs first anyway, which is why the button must not be dead there.
   */
  describe('on the home', () => {
    beforeEach(() => {
      useLayouts.setState({ home: true })
    })

    it('offers a new project instead of a new document', () => {
      render(<Rail side="left" />)

      expect(screen.getByRole('button', { name: 'Nouveau projet' })).toBeInTheDocument()
      expect(screen.queryByRole('button', { name: 'Nouveau document' })).not.toBeInTheDocument()
    })

    it('stays clickable with no project open — creating one needs no project', async () => {
      useProject.setState({ project: null })
      const createPicked = vi.fn(() => Promise.resolve())
      useProject.setState({ createPicked })
      render(<Rail side="left" />)

      const button = screen.getByRole('button', { name: 'Nouveau projet' })
      expect(button).not.toBeDisabled()

      await userEvent.click(button)
      expect(createPicked).toHaveBeenCalled()
    })

    /**
     * Two separators: the one that fences the create button off from the panels, and the cut
     * between the two halves — the projects above, the open one read as a folder below. The
     * projects keep their own half, which is the whole point of what came down on 13 August:
     * nothing here can take them off the screen.
     */
    it('cuts the left rail below the create button, and between its two halves', () => {
      const { container } = render(<Rail side="left" />)

      expect(marksOf(container)).toEqual([
        'Nouveau projet',
        'separator',
        'Vos projets',
        'separator',
        'Explorateur',
        // Same half as the folder, and after it: the folder is what the half opens on, the
        // versions of that folder and what it is about are what one switches to. All three
        // need a project open.
        'Git',
        'Contexte',
      ])

      // `marksOf` reads buttons and separators, so it cannot see the hole an empty zone leaves:
      // a childless flex item still eats one of the rail's gaps.
      expect(
        [...container.querySelectorAll('div')].filter(node => node.childElementCount === 0),
      ).toEqual([])
    })

    /**
     * The right rail is the legend of the band's right half alone, since the home's right COLUMN
     * went with the account's library: the history of the open project, and no separator — this
     * screen acts on no document, so it has nothing to open into.
     */
    it('draws the right rail as the band alone', () => {
      const { container } = render(<Rail side="right" />)

      expect(marksOf(container)).toEqual(['Historique'])
    })

    // No half names a panel on the default layout, so what reads as up is the first one the
    // registry declares there — never the one taking its turn behind it.
    it('marks the first panel of each half as up on the default layout', () => {
      useTools.setState({ arrangements: DEFAULT_ARRANGEMENTS })
      render(<Rail side="left" />)

      expect(screen.getByRole('button', { name: 'Vos projets' })).toHaveAttribute(
        'aria-pressed',
        'true',
      )
      expect(screen.getByRole('button', { name: 'Explorateur' })).toHaveAttribute(
        'aria-pressed',
        'true',
      )
    })

    /**
     * The one panel this surface offers conditionally: it reads a project folder, and the home
     * is where one is opened. Standing there with none, it would say « no project open » beside
     * the very shelf that opens one.
     */
    it('drops the Explorer while no project is open', () => {
      useProject.setState({ project: null })
      const { container } = render(<Rail side="left" />)

      expect(marksOf(container)).toEqual(['Nouveau projet', 'separator', 'Vos projets'])
    })
  })

  /**
   * 🛑 The icon used to be DROPPED while no model was chosen. That is the one moment a person
   * needs the panel most — it is what would have offered them a model — and the rail answered by
   * hiding it. ADR-23 § D: the picker lives inside the panel, and the panel says what is missing.
   */
  it('offers the generator icon whether or not a model is chosen', () => {
    render(<Rail side="left" />)
    expect(screen.getByRole('button', { name: 'Génération' })).toBeInTheDocument()

    useModels.setState({ selected: { [aiRoleId('3d', 'txt23d')]: 'tripo-v3' } })
    expect(screen.getByRole('button', { name: 'Génération' })).toBeInTheDocument()
  })

  // The separator is decorative, hence hidden from assistive tech — it is read here as a
  // position in the rail, not as a control.
  function marksOf(container: HTMLElement): string[] {
    return [...container.querySelectorAll('button, span[aria-hidden="true"]')].map(
      node => node.getAttribute('aria-label') ?? 'separator',
    )
  }

  // The left rail is the Scenario side under the button that makes a document — a model, its
  // form, and the shelf they fill — then the cut, then what is already on disk. The rail is the
  // legend of the column, so it has to draw the same cut.
  //
  // The shelf comes LAST of the three above the cut, and that is what keeps the Models in front
  // when a space is entered: a half with nothing chosen opens on the first tool it declares.
  it('puts the Scenario panels on the left rail, under the new-document button', () => {
    useModels.setState({ selected: { [aiRoleId('3d', 'txt23d')]: 'tripo-v3' } })
    const { container } = render(<Rail side="left" />)

    expect(marksOf(container)).toEqual([
      'Nouveau document',
      'separator',
      'Génération',
      'Bibliothèque',
      'separator',
      'Explorateur',
      'Git',
      'Contexte',
      // Nothing at the foot: the band's left half is where a panel is dragged, and no placement
      // declares one there — its tools all hang on the right, and so do their icons.
    ])
  })

  it('cuts the right rail where the column is cut: the document above, the selection below', () => {
    const { container } = render(<Rail side="right" />)

    expect(marksOf(container)).toEqual([
      'Scène',
      'Lumières',
      'Mailles',
      'Animations',
      'separator',
      'Inspecteur',
      // At the FOOT of this rail since the band was split: its right half is the one this side
      // carries, and every panel of the band declares that half.
      'Timeline',
      'Code',
      'Historique',
    ])
  })

  // On the default layout no half names a panel, so the icon that reads as up is the first one
  // the section declares — the Models in the upper left, never the generator taking its turn.
  it('marks the section-first panel as up on the default layout', () => {
    useLayouts.setState({ activeWorkspace: 'image' })
    useModels.setState({ selected: { [aiRoleId('image', 'txt2img')]: 'flux-dev' } })
    useTools.setState({ arrangements: DEFAULT_ARRANGEMENTS })
    render(<Rail side="left" />)

    expect(screen.getByRole('button', { name: 'Génération' })).toHaveAttribute(
      'aria-pressed',
      'true',
    )
    expect(screen.getByRole('button', { name: 'Bibliothèque' })).toHaveAttribute(
      'aria-pressed',
      'false',
    )
  })

  // The panel a section stands in for another is the one that is up, so its icon is the one
  // that reads as up — and a click on it closes the half instead of merely restating it.
  it('accents the icon of the panel the half actually shows', async () => {
    useLayouts.setState({ activeWorkspace: 'video' })
    useTools.setState({
      arrangements: arrangedFor('image', { open: { bottomRight: { primary: 'assets' } } }),
    })
    // The right rail: the band's right half is the one it carries, and the montage lies there.
    render(<Rail side="right" />)

    const montage = screen.getByRole('button', { name: 'Timeline' })
    expect(montage).toHaveAttribute('aria-pressed', 'true')

    await userEvent.click(montage)
    expect(arrangementOf(useTools.getState(), 'image').open.bottomRight?.primary).toBeUndefined()
  })
})
