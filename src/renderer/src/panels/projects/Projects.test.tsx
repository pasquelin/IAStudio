import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { StrictMode } from 'react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { Manifest, RecentProject } from '@shared/domain/project'
import { installFakeBridge } from '@/services/fake-bridge'
import { useProject } from '@/stores/project'
import { useSettings } from '@/stores/settings'
import { Projects } from './Projects'

const SUMMER: RecentProject = {
  path: '/projects/summer',
  name: 'Summer',
  openedAt: '2026-08-10T09:00:00.000Z',
  createdAt: '2026-05-01T09:00:00.000Z',
}

const MANIFEST: Manifest = {
  version: 1,
  name: 'Summer',
  createdAt: '2026-05-01T09:00:00.000Z',
  updatedAt: '2026-08-10T09:00:00.000Z',
}

function setRecent(recentProjects: RecentProject[]): void {
  useSettings.setState(state => ({
    settings: { ...state.settings, storage: { ...state.settings.storage, recentProjects } },
  }))
}

beforeEach(() => {
  vi.clearAllMocks()
  setRecent([SUMMER])
  useProject.setState({ project: null })
})

describe('the projects panel', () => {
  it('lists what has been opened', () => {
    render(<Projects />)

    expect(screen.getByText('Summer')).toBeInTheDocument()
  })

  /**
   * The order is the date the PROJECT was made, newest first — never the stored order, which is
   * by most-recently-opened. Held here as well as on `projectsByCreation`: the pure function can
   * be right while the panel reads the raw array, which is exactly what it did.
   */
  it('lists the newest-made project first, whatever order the settings hold', () => {
    setRecent([
      { ...SUMMER, path: '/projects/old', name: 'Old', createdAt: '2026-01-01T00:00:00.000Z' },
      { ...SUMMER, path: '/projects/new', name: 'New', createdAt: '2026-08-13T00:00:00.000Z' },
    ])

    render(<Projects />)

    const names = screen.getAllByRole('listitem').map(row => row.textContent)
    expect(names[0]).toContain('New')
    expect(names[1]).toContain('Old')
  })

  /**
   * The defect the whole ordering answers: the click that opens rewrites the stored list, so a
   * list drawn from it reshuffled under the pointer that had just aimed at a row.
   */
  it('does not reorder itself when a project is opened', async () => {
    const open = vi.fn(() => Promise.resolve(true))
    useProject.setState({ open })
    setRecent([
      { ...SUMMER, path: '/projects/old', name: 'Old', createdAt: '2026-01-01T00:00:00.000Z' },
      { ...SUMMER, path: '/projects/new', name: 'New', createdAt: '2026-08-13T00:00:00.000Z' },
    ])
    render(<Projects />)

    await userEvent.click(screen.getByText('Old'))
    // What the main process writes back on an opening: the stored order flips.
    setRecent(
      [
        { ...SUMMER, path: '/projects/old', name: 'Old', createdAt: '2026-01-01T00:00:00.000Z' },
        { ...SUMMER, path: '/projects/new', name: 'New', createdAt: '2026-08-13T00:00:00.000Z' },
      ].reverse(),
    )

    expect(screen.getAllByRole('listitem')[0]?.textContent).toContain('New')
  })

  /**
   * What `selectedIds` paints here is not a selection but WHERE ONE IS — the folder the studio has
   * open. `data-accented` is what takes the fill to the full accent and both inks to white; the
   * role stays `listitem`, since a row that only opens has no selected state to announce.
   */
  it('paints the open project with the accent, and only that one', () => {
    setRecent([SUMMER, { ...SUMMER, path: '/projects/winter', name: 'Winter' }])
    useProject.setState({ project: { path: '/projects/summer', manifest: MANIFEST } })

    render(<Projects />)

    const [summer, winter] = screen.getAllByRole('listitem')
    expect(summer).toHaveAttribute('data-accented', 'true')
    expect(summer).not.toHaveAttribute('aria-selected')
    expect(winter).not.toHaveAttribute('data-accented')
  })

  it('paints none of them while no project is open', () => {
    render(<Projects />)

    expect(screen.getByRole('listitem')).not.toHaveAttribute('data-accented')
  })

  // A single click, not a double: a project is a place to go, not a row to pick.
  it('opens a project on one click', async () => {
    const open = vi.fn(() => Promise.resolve(true))
    useProject.setState({ open })
    render(<Projects />)

    await userEvent.click(screen.getByText('Summer'))

    expect(open).toHaveBeenCalledWith('/projects/summer')
  })

  /**
   * A panel drawing nothing under a rail icon reads as a bug. It was a band that simply took
   * itself off the page; a column cannot do that, so the emptiness has to say what to do about
   * it — and this is the very first screen a fresh install shows.
   */
  it('says what to do rather than standing empty on a fresh install', () => {
    setRecent([])
    render(<Projects />)

    expect(screen.getByText('Créer votre premier projet')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Créer un projet' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Ouvrir un projet' })).toBeInTheDocument()
  })

  it('offers both ways out of that emptiness', async () => {
    const createPicked = vi.fn(() => Promise.resolve())
    const openPicked = vi.fn(() => Promise.resolve())
    setRecent([])
    useProject.setState({ createPicked, openPicked })
    render(<Projects />)

    await userEvent.click(screen.getByRole('button', { name: 'Créer un projet' }))
    expect(createPicked).toHaveBeenCalled()

    await userEvent.click(screen.getByRole('button', { name: 'Ouvrir un projet' }))
    expect(openPicked).toHaveBeenCalled()
  })

  /**
   * The row opens on a SINGLE click, and its menu offers to forget the project. Left to bubble,
   * the press that opens the menu would open the very project it is about to drop — tearing down
   * every panel and reloading a catalogue on the way.
   */
  it('does not open the project when its menu button is pressed', async () => {
    const open = vi.fn(() => Promise.resolve(true))
    useProject.setState({ open })
    render(<Projects />)

    await userEvent.click(screen.getByRole('button', { name: 'Actions du projet' }))

    expect(screen.getByRole('menuitem', { name: 'Retirer de la liste' })).toBeInTheDocument()
    expect(open).not.toHaveBeenCalled()
  })

  /**
   * The same trap through the right-click, which is the gesture that has no button to hide
   * behind: `ContextMenu` portals to `body`, but React bubbles synthetic events through the
   * REACT tree, so the press was reaching the cell and opening the project being dropped.
   */
  it('does not open the project when a row of its context menu is chosen', async () => {
    const open = vi.fn(() => Promise.resolve(true))
    const forget = vi.fn(() => Promise.resolve())
    useProject.setState({ open, forget })
    render(<Projects />)

    await userEvent.pointer({ target: screen.getByText('Summer'), keys: '[MouseRight]' })
    await userEvent.click(screen.getByRole('menuitem', { name: 'Retirer de la liste' }))

    expect(forget).toHaveBeenCalledWith('/projects/summer')
    expect(open).not.toHaveBeenCalled()
  })
})

describe('the room a project row is given', () => {
  /**
   * The one list in the studio that stacks a name over a subtitle, and the one the report came
   * from: its rows were touching. At the control height two steps of `leading-tight` text fill
   * the row edge to edge, so the shape it declares is the whole fix — and nothing else here
   * would notice it going away.
   */
  it('asks for the stacked height, not the height of a one-line row', () => {
    setRecent([SUMMER, { ...SUMMER, path: '/projects/winter', name: 'Winter' }])

    render(<Projects />)

    // 44 shipped + 4 of gap, twice: the stacked gauge, not the 28 of `--sc-control`. 44 and not
    // the 36 it shipped at — two steps of text left ~4px of room, which on a FILLED row reads as
    // words pressed against the edge of their own highlight.
    expect(screen.getByRole('list')).toHaveStyle({ height: '96px' })
  })
})

/**
 * Renaming, held by the panel because the double-click that starts it lands on the collection cell
 * and only one row may hold a field at a time.
 *
 * Rendered under StrictMode throughout, and that is the whole reason these read as they do: the
 * window runs under it (`main.tsx`) and `render` does not, so a suite without it watched the field
 * open while no rename in the running app did — the cleanup StrictMode replays took the focus off a
 * field still on screen, `onBlur` read that as a commit, and the panel closed it a frame later.
 */
describe('renaming from the panel', () => {
  const renderPanel = () => render(<Projects />, { wrapper: StrictMode })

  const startFromMenu = async (): Promise<void> => {
    await userEvent.click(screen.getByRole('button', { name: 'Actions du projet' }))
    await userEvent.click(screen.getByRole('menuitem', { name: 'Renommer' }))
  }

  it('opens the field on a double-click, and leaves it focused', async () => {
    renderPanel()

    await userEvent.dblClick(screen.getByText('Summer'))

    expect(screen.getByRole('textbox', { name: 'Renommer' })).toHaveFocus()
  })

  /**
   * The menu closes as it hands the gesture back, and the field mounts in that same commit. It once
   * took a `requestAnimationFrame` to keep the two apart — removed, and measured: a frame never
   * comes for an occluded window, so the row silently did nothing there.
   */
  it('opens the field from the row menu, without waiting for a frame', async () => {
    renderPanel()

    await startFromMenu()

    expect(screen.getByRole('textbox', { name: 'Renommer' })).toHaveFocus()
  })

  it('writes the new name on Enter, and gives the row back', async () => {
    const rename = vi.fn(() => Promise.resolve(true))
    useProject.setState({ rename })
    renderPanel()
    await startFromMenu()

    await userEvent.clear(screen.getByRole('textbox', { name: 'Renommer' }))
    await userEvent.type(screen.getByRole('textbox', { name: 'Renommer' }), 'Winter{Enter}')

    expect(rename).toHaveBeenCalledExactlyOnceWith('/projects/summer', 'Winter')
    expect(screen.getByText('Summer')).toBeInTheDocument()
  })

  // Abandoning must cost nothing: `InlineRename` commits the ORIGINAL name on Escape, and a write
  // fired for it would stamp `updatedAt` and rewrite the settings for a gesture that said no.
  it('writes nothing when the edit is abandoned', async () => {
    const rename = vi.fn(() => Promise.resolve(true))
    useProject.setState({ rename })
    renderPanel()
    await startFromMenu()

    await userEvent.type(screen.getByRole('textbox', { name: 'Renommer' }), '{Escape}')

    expect(rename).not.toHaveBeenCalled()
  })

  /**
   * The trap this list has and the lists `InlineRename` was written for do not: they SELECT on a
   * single click, this one OPENS. A click landing in the field would tear down every panel and
   * reload a catalogue while a name was being typed.
   */
  it('does not open the project when the field is clicked', async () => {
    const open = vi.fn(() => Promise.resolve(true))
    useProject.setState({ open })
    renderPanel()
    await startFromMenu()

    await userEvent.click(screen.getByRole('textbox', { name: 'Renommer' }))

    expect(open).not.toHaveBeenCalled()
  })

  // A failure reaches the journal rather than the promise it was thrown into: the field is gone by
  // the time the answer comes, and a rename that silently did nothing reads as a dead menu.
  /**
   * The store ANSWERS a refusal rather than throwing it — the disk error is swallowed on the way
   * (`stores/project.ts`) — so a stub that rejects would exercise a path the real one never takes,
   * and the panel's own `.catch` would have looked right while catching nothing.
   */
  it('says so when the rename was refused', async () => {
    const report = vi.fn(() => Promise.resolve())
    installFakeBridge({ diagnostics: { report } })
    useProject.setState({ rename: () => Promise.resolve(false) })
    renderPanel()
    await startFromMenu()

    await userEvent.clear(screen.getByRole('textbox', { name: 'Renommer' }))
    await userEvent.type(screen.getByRole('textbox', { name: 'Renommer' }), 'Winter{Enter}')

    expect(report).toHaveBeenCalledWith(
      expect.objectContaining({ level: 'error', scope: 'project.rename' }),
    )
  })
})
