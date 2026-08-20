import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { useGit } from '@/stores/git'
import { GitRefreshButton } from './GitRefreshButton'

beforeEach(() => {
  useGit.setState({ busy: false })
})

describe('the refresh both version panels wear', () => {
  it('asks again for whatever the panel handed it', async () => {
    const onClick = vi.fn()
    render(<GitRefreshButton description="Relit le dépôt" onClick={onClick} />)

    await userEvent.click(screen.getByRole('button', { name: 'Actualiser' }))

    expect(onClick).toHaveBeenCalledTimes(1)
  })

  // A second read started under the first is what leaves the working copy and the log
  // describing different repositories.
  it('refuses while a read is already in flight', () => {
    useGit.setState({ busy: true })
    render(<GitRefreshButton description="Relit le dépôt" onClick={vi.fn()} />)

    expect(screen.getByRole('button', { name: 'Actualiser' })).toBeDisabled()
  })

  // The label is already on screen for a reader; the tooltip says what the two panels do
  // differently, which is the only thing that separates them.
  it('explains what it re-reads rather than reading its own label back', () => {
    render(<GitRefreshButton description="Relit le dépôt" onClick={vi.fn()} />)

    expect(screen.getByRole('button', { name: 'Actualiser' })).toHaveAttribute(
      'data-tooltip-content',
      'Relit le dépôt',
    )
  })
})
