import { render, screen } from '@testing-library/react'
import { beforeEach, describe, expect, it } from 'vitest'
import type { ActivityEntry } from '@shared/domain/activity'
import { useActivity } from '@/stores/activity'
import { settleHome } from '../home-fixtures'
import { Activity } from './Activity'

const entry = (id: number, detail?: string): ActivityEntry => ({
  id,
  at: '2026-08-09T10:00:00.000Z',
  level: 'error',
  topic: 'generation',
  messageKey: 'activity.messages.generationFailed',
  ...(detail !== undefined && { detail }),
})

beforeEach(() => {
  settleHome()
  useActivity.setState({ entries: [entry(1)], levels: [], topics: [] })
})

describe('the home journal band', () => {
  /**
   * The band draws the panel's own row. Written twice, the two had already drifted: the home
   * had lost `tabular-nums`, so its timestamps did not line up down the column.
   */
  it('lines its timestamps up in a column, as the journal panel does', () => {
    render(<Activity />)

    const stamp = screen.getByText(/\d/, { selector: 'span.tabular-nums' })
    expect(stamp).toBeInTheDocument()
  })

  /** A long message must not squeeze the level glyph — the panel had no `shrink-0` either. */
  it('keeps the level glyph at its size whatever the message is', () => {
    const { container } = render(<Activity />)

    expect(container.querySelector('svg.shrink-0')).not.toBeNull()
  })

  it('says nothing rather than announcing its own emptiness', () => {
    useActivity.setState({ entries: [] })

    const { container } = render(<Activity />)

    expect(container).toBeEmptyDOMElement()
  })
})
