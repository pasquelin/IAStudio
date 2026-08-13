import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { RecentProject } from '@shared/domain/project'
import { installFakeBridge } from '@/services/fake-bridge'
import { useProject } from '@/stores/project'
import { ProjectRow } from './ProjectRow'

const DAY = 24 * 60 * 60 * 1000

// Relative to now rather than a fixed stamp: `timeAgo` reads the clock, and fake timers would
// take `userEvent` with them.
const SUMMER: RecentProject = {
  path: '/projects/summer',
  name: 'Summer',
  openedAt: new Date(Date.now() - 3 * DAY).toISOString(),
}

beforeEach(() => {
  installFakeBridge()
})

describe('one row of the projects shelf', () => {
  /**
   * The whole point of the row: two projects called `Test` are told apart by their folder and by
   * nothing else, and "where is it?" is the question the shelf could not answer.
   */
  it('names the folder under the project name', () => {
    render(<ProjectRow project={SUMMER} />)

    expect(screen.getByText('Summer')).toBeInTheDocument()
    expect(screen.getByText('/projects/summer')).toBeInTheDocument()
  })

  // The date has not gone, and the tooltip carries the whole path too: a narrow panel truncates
  // the subtitle, which is exactly when hovering is the only way to read it.
  it('keeps the date and the whole path in the tooltip', () => {
    render(<ProjectRow project={SUMMER} />)

    expect(screen.getByText('Summer')).toHaveAttribute(
      'data-tooltip-content',
      '/projects/summer — ouvert il y a 3 jours',
    )
  })

  /**
   * A tooltip is hover-only, so the date it carries answers nobody walking the shelf with the
   * arrows — and « where was I » is the question the home exists to answer.
   */
  it('leaves the date to a reader as well, not only to a pointer', () => {
    render(<ProjectRow project={SUMMER} />)

    expect(screen.getByText('Ouvert il y a 3 jours')).toBeInTheDocument()
  })

  // A hand-edited settings file reaches here. A tooltip reading "Invalid Date" is worse than one
  // that only says where the project is.
  it('falls back to the path alone when the date cannot be read', () => {
    render(<ProjectRow project={{ ...SUMMER, openedAt: 'not-a-date' }} />)

    expect(screen.getByText('Summer')).toHaveAttribute('data-tooltip-content', '/projects/summer')
    expect(screen.queryByText(/^Ouvert/)).not.toBeInTheDocument()
  })

  it('opens its menu on a right-click', async () => {
    render(<ProjectRow project={SUMMER} />)

    await userEvent.pointer({ target: screen.getByText('Summer'), keys: '[MouseRight]' })

    expect(screen.getByRole('menuitem', { name: 'Retirer de la liste' })).toBeInTheDocument()
  })

  /**
   * A right-click is not a keyboard gesture: `contextmenu` from Shift+F10 targets the focused
   * cell, not the div inside it that listens. Without this button the menu could only be opened
   * with a mouse.
   */
  it('offers the same rows to a keyboard, through a button of its own', async () => {
    render(<ProjectRow project={SUMMER} />)

    await userEvent.click(screen.getByRole('button', { name: 'Actions du projet' }))

    expect(screen.getByRole('menuitem', { name: 'Révéler dans le dossier' })).toBeInTheDocument()
    expect(screen.getByRole('menuitem', { name: 'Retirer de la liste' })).toBeInTheDocument()
  })
})

/**
 * Renaming, from the row's own menu. The field is `InlineRename`, the same one the layer stack, the
 * track headers and the explorer edit their names with — what is this row's own is that the list it
 * sits in OPENS on a single click, so the field has to stop one.
 */
describe('renaming a project from its row', () => {
  const startRenaming = async (): Promise<void> => {
    await userEvent.click(screen.getByRole('button', { name: 'Actions du projet' }))
    await userEvent.click(screen.getByRole('menuitem', { name: 'Renommer' }))
  }

  it('swaps the row for a field holding the current name', async () => {
    render(<ProjectRow project={SUMMER} />)

    await startRenaming()

    expect(screen.getByRole('textbox', { name: 'Renommer' })).toHaveValue('Summer')
  })

  it('writes the new name on Enter, and gives the row back', async () => {
    const rename = vi.fn(() => Promise.resolve(true))
    useProject.setState({ rename })
    render(<ProjectRow project={SUMMER} />)
    await startRenaming()

    await userEvent.clear(screen.getByRole('textbox', { name: 'Renommer' }))
    await userEvent.type(screen.getByRole('textbox', { name: 'Renommer' }), 'Winter{Enter}')

    expect(rename).toHaveBeenCalledWith('/projects/summer', 'Winter')
  })

  // Abandoning must cost nothing: `InlineRename` commits the ORIGINAL name on Escape, and a write
  // fired for it would stamp `updatedAt` and rewrite the settings for a gesture that said no.
  it('writes nothing when the edit is abandoned', async () => {
    const rename = vi.fn(() => Promise.resolve(true))
    useProject.setState({ rename })
    render(<ProjectRow project={SUMMER} />)
    await startRenaming()

    await userEvent.type(screen.getByRole('textbox', { name: 'Renommer' }), '{Escape}')

    expect(rename).not.toHaveBeenCalled()
  })

  /**
   * The trap this row has and the lists `InlineRename` was written for do not: they SELECT on a
   * single click, this one OPENS. A click landing in the field would tear down every panel and
   * reload a catalogue while a name was being typed.
   */
  it('does not open the project when the field is clicked', async () => {
    const open = vi.fn(() => Promise.resolve(true))
    useProject.setState({ open })
    render(
      <div onClick={() => void useProject.getState().open(SUMMER.path)}>
        <ProjectRow project={SUMMER} />
      </div>,
    )
    await startRenaming()

    await userEvent.click(screen.getByRole('textbox', { name: 'Renommer' }))

    expect(open).not.toHaveBeenCalled()
  })

  // A failure reaches the journal rather than the promise it was thrown into: the field is gone by
  // the time the answer comes, and a rename that silently did nothing reads as a dead menu.
  it('says so when the rename was refused', async () => {
    const report = vi.fn(() => Promise.resolve())
    installFakeBridge({ diagnostics: { report } })
    useProject.setState({ rename: () => Promise.reject(new Error('read-only disk')) })
    render(<ProjectRow project={SUMMER} />)
    await startRenaming()

    await userEvent.clear(screen.getByRole('textbox', { name: 'Renommer' }))
    await userEvent.type(screen.getByRole('textbox', { name: 'Renommer' }), 'Winter{Enter}')

    expect(report).toHaveBeenCalledWith(
      expect.objectContaining({ level: 'error', scope: 'project.rename' }),
    )
  })
})
