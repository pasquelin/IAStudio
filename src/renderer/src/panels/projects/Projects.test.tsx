import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { RecentProject } from '@shared/domain/project'
import { useProject } from '@/stores/project'
import { useSettings } from '@/stores/settings'
import { Projects } from './Projects'

const SUMMER: RecentProject = {
  path: '/projects/summer',
  name: 'Summer',
  openedAt: '2026-08-10T09:00:00.000Z',
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
  it('lists what has been opened, newest first as the settings hold them', () => {
    render(<Projects />)

    expect(screen.getByText('Summer')).toBeInTheDocument()
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

  // A hand-edited settings file reaches here: the row must still name the project.
  it('falls back to the path when the date cannot be read', () => {
    setRecent([{ ...SUMMER, openedAt: 'not-a-date' }])
    render(<Projects />)

    expect(screen.getByText('/projects/summer')).toBeInTheDocument()
  })
})
