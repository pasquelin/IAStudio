import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
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

beforeEach(() => {
  useActivity.setState({ entries: [], levels: [], topics: [], unread: [] })
})

describe('the journal, drawn', () => {
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

describe('the filters of the journal', () => {
  const familyOf = (name: string) => within(screen.getByRole('group', { name }))

  // A row per family rather than a wrap: seven chips do not fit the 384px flyout, and the break
  // used to land past the separator — leaving the subjects orphaned of what announced them. The
  // name is also what tells the two "Tout" apart, their label being the same in both.
  it('holds each family in a row of its own, named, with a "Tout" of its own', () => {
    render(<ActivityList />)

    expect(familyOf('Niveau').getByRole('button', { name: 'Échec' })).toBeInTheDocument()
    expect(familyOf('Niveau').getByRole('button', { name: 'Tout' })).toBeInTheDocument()
    expect(familyOf('Sujet').getByRole('button', { name: 'Import' })).toBeInTheDocument()
    expect(familyOf('Sujet').getByRole('button', { name: 'Tout' })).toBeInTheDocument()
  })

  it('shows "Tout" as the choice in force while its family narrows nothing', () => {
    useActivity.setState({ levels: ['error'] })

    render(<ActivityList />)

    expect(familyOf('Niveau').getByRole('button', { name: 'Tout' })).toHaveAttribute(
      'aria-pressed',
      'false',
    )
    expect(familyOf('Sujet').getByRole('button', { name: 'Tout' })).toHaveAttribute(
      'aria-pressed',
      'true',
    )
  })

  it('clears one family and leaves the other filtering', async () => {
    useActivity.setState({ levels: ['error'], topics: ['import'] })
    render(<ActivityList />)

    await userEvent.click(familyOf('Niveau').getByRole('button', { name: 'Tout' }))

    expect(useActivity.getState().levels).toEqual([])
    expect(useActivity.getState().topics).toEqual(['import'])
  })

  /**
   * The panel is the side that gained this: it drew its glyph without `shrink-0`, so a long
   * message squeezed it while the home's copy held its size.
   */
  it('keeps the level glyph at its size whatever the message is', () => {
    useActivity.setState({ entries: [entry()] })

    const { container } = render(<ActivityList />)

    expect(container.querySelector('svg.shrink-0')).not.toBeNull()
  })
})
