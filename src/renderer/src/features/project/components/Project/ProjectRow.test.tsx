import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { RecentProject } from '@shared/domain/project'
import { installFakeBridge } from '@/services/fakeBridge'
import { ProjectRow } from './ProjectRow'

const DAY = 24 * 60 * 60 * 1000

// Relative to now rather than a fixed stamp: `timeAgo` reads the clock, and fake timers would
// take `userEvent` with them.
const SUMMER: RecentProject = {
  path: '/projects/Summer',
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
    expect(screen.getByText('/projects/Summer')).toBeInTheDocument()
  })

  // The date has not gone, and the tooltip carries the whole path too: a narrow panel truncates
  // the subtitle, which is exactly when hovering is the only way to read it.
  it('keeps the date and the whole path in the tooltip', () => {
    render(<ProjectRow project={SUMMER} />)

    expect(screen.getByText('Summer')).toHaveAttribute(
      'data-tooltip-content',
      '/projects/Summer — ouvert il y a 3 jours',
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

    expect(screen.getByText('Summer')).toHaveAttribute('data-tooltip-content', '/projects/Summer')
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

    expect(screen.getByRole('menuitem', { name: 'Afficher dans le dossier' })).toBeInTheDocument()
    expect(screen.getByRole('menuitem', { name: 'Retirer de la liste' })).toBeInTheDocument()
  })
})

/**
 * Renaming belongs to the panel — the double-click that starts it lands on the collection cell,
 * and only one row may hold a field at a time. What is left here is the row's PROP CONTRACT; that
 * the two gestures reach a field is asserted where the state lives, in `Projects.test.tsx`.
 */
describe('what the row does with the rename props it is handed', () => {
  // Refused rather than dead where the panel offers no field: a row that explains nothing and does
  // nothing is the worst of the outcomes this menu can produce.
  it('refuses the menu row where the panel offers none', async () => {
    render(<ProjectRow project={SUMMER} />)

    await userEvent.click(screen.getByRole('button', { name: 'Actions du projet' }))

    expect(screen.getByRole('menuitem', { name: 'Renommer' })).toBeDisabled()
  })

  // The commit handler is the whole signal: handed one, the row IS the field. No second flag says
  // so, which is the state a caller could otherwise ask for and never get.
  it('becomes the field on being handed somewhere to commit', () => {
    render(<ProjectRow project={SUMMER} onRenameCommit={vi.fn()} />)

    expect(screen.getByRole('textbox', { name: 'Renommer' })).toHaveValue('Summer')
  })

  // Named rather than closed over, so the panel builds one handler for the whole list and this row
  // stays memoised against something.
  it('names itself when it asks, rather than closing over its own path', async () => {
    const onRenameStart = vi.fn()
    render(<ProjectRow project={SUMMER} onRenameStart={onRenameStart} />)

    await userEvent.dblClick(screen.getByText('Summer'))

    expect(onRenameStart).toHaveBeenCalledExactlyOnceWith('/projects/Summer')
  })
})
