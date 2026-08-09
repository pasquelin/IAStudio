import { render } from '@testing-library/react'
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
    // Never on the text: `timeAgo` says "hier" past a day, and a case that asserts a digit
    // starts failing on its own the morning after its fixture was written.
    const { container } = render(<Activity />)

    expect(container.querySelector('span.tabular-nums')).not.toBeNull()
  })

  /** The band indents like the jobs band above it, which the panel's row already did. */
  it('starts its lines at the same column as the band beside it', () => {
    const { container } = render(<Activity />)

    expect(container.querySelector('li.px-2')).not.toBeNull()
  })

  it('says nothing rather than announcing its own emptiness', () => {
    useActivity.setState({ entries: [] })

    const { container } = render(<Activity />)

    expect(container).toBeEmptyDOMElement()
  })
})
