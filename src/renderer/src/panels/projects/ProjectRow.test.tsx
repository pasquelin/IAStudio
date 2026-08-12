import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it } from 'vitest'
import type { RecentProject } from '@shared/domain/project'
import { installFakeBridge } from '@/services/fake-bridge'
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

  // A hand-edited settings file reaches here. A tooltip reading "Invalid Date" is worse than one
  // that only says where the project is.
  it('falls back to the path alone when the date cannot be read', () => {
    render(<ProjectRow project={{ ...SUMMER, openedAt: 'not-a-date' }} />)

    expect(screen.getByText('Summer')).toHaveAttribute('data-tooltip-content', '/projects/summer')
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
