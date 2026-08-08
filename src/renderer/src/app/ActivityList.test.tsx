import { render, screen } from '@testing-library/react'
import { beforeEach, describe, expect, it } from 'vitest'
import type { ActivityEntry } from '@shared/domain/activity'
import { useActivity } from '@/stores/activity'
import { ActivityList } from './ActivityList'

const entry = (overrides: Partial<ActivityEntry> = {}): ActivityEntry => ({
  id: 1,
  at: '2026-08-08T10:00:00.000Z',
  level: 'error',
  topic: 'library',
  messageKey: 'activity.pushFailed',
  params: { name: 'moss.png' },
  ...overrides,
})

describe('the journal, drawn', () => {
  beforeEach(() => {
    useActivity.setState({ entries: [], levels: [], topics: [], unread: [] })
  })

  // A selector deriving a fresh array is a new snapshot every render, which React answers with
  // another render — the panel threw "Maximum update depth exceeded" the moment it opened.
  it('renders its lines rather than looping on its own selector', () => {
    useActivity.setState({ entries: [entry()] })

    render(<ActivityList />)

    expect(screen.getByText(/moss\.png/)).toBeInTheDocument()
  })

  it('says so when there is nothing to report', () => {
    render(<ActivityList />)

    expect(screen.getByText('Rien à signaler.')).toBeInTheDocument()
  })

  it('distinguishes an empty journal from one its filters emptied', () => {
    useActivity.setState({ entries: [entry({ level: 'info' })], levels: ['error'] })

    render(<ActivityList />)

    expect(screen.getByText('Rien ne correspond à ce filtre.')).toBeInTheDocument()
  })

  it('shows the detail beside the message, which is what one is asked for', () => {
    useActivity.setState({ entries: [entry({ detail: 'HTTP 429' })] })

    render(<ActivityList />)

    expect(screen.getByText('HTTP 429')).toBeInTheDocument()
  })
})
