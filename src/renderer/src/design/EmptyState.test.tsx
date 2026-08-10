import { mdiFolderOpenOutline } from '@mdi/js'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { EmptyState } from './EmptyState'

const props = { icon: mdiFolderOpenOutline, message: 'Nothing here yet' }

describe('the empty state of a panel', () => {
  it('says why it is empty even when nothing can be done about it', () => {
    render(<EmptyState {...props} />)

    expect(screen.getByText('Nothing here yet')).toBeInTheDocument()
    expect(screen.queryByRole('button')).toBeNull()
  })

  it('offers the way out it was given', async () => {
    const onClick = vi.fn()
    render(<EmptyState {...props} action={{ label: 'Open', onClick }} />)

    await userEvent.click(screen.getByRole('button', { name: 'Open' }))

    expect(onClick).toHaveBeenCalled()
  })

  // No project is either one to open or one to make: offering only the first was the half
  // that was missing, and it sent the user back to the home for the other.
  it('offers a second way out, for an emptiness that has two', async () => {
    const create = vi.fn()
    render(
      <EmptyState
        {...props}
        action={{ label: 'Open', onClick: vi.fn() }}
        secondary={{ label: 'Create', onClick: create }}
      />,
    )

    expect(screen.getAllByRole('button')).toHaveLength(2)
    await userEvent.click(screen.getByRole('button', { name: 'Create' }))

    expect(create).toHaveBeenCalled()
  })

  // A second action dropped because the first was left out would be a way out nobody can see.
  it('draws a second way out even with no first one', () => {
    render(<EmptyState {...props} secondary={{ label: 'Create', onClick: vi.fn() }} />)

    expect(screen.getByRole('button', { name: 'Create' })).toBeInTheDocument()
  })
})
