import { render, screen } from '@testing-library/react'
import { beforeEach, describe, expect, it } from 'vitest'
import { STATUS_BUTTON } from '@/design/styles'
import { useActivity } from '@/stores/activity'
import { ActivityStatus } from './ActivityStatus'

beforeEach(() => {
  useActivity.setState({ entries: [], levels: [], topics: [], unread: [] })
})

describe('the journal indicator', () => {
  // Icon-only it was a 12 x 12 target; `STATUS_BUTTON` carries why, and the gauges that fix it.
  it('offers the target the status line shares', () => {
    render(<ActivityStatus />)

    expect(screen.getByRole('button', { name: 'Afficher le journal' })).toHaveClass(STATUS_BUTTON)
  })
})
