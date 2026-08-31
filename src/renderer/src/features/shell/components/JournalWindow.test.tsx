import { render, screen } from '@testing-library/react'
import { beforeEach, describe, expect, it } from 'vitest'
import type { ActivityEntry } from '@shared/domain/activity'
import { installFakeBridge } from '@/services/fakeBridge'
import { useActivity } from '@/stores/activity'
import { JournalWindow } from './JournalWindow'

const entry = (id: number, at: string): ActivityEntry => ({
  id,
  at,
  level: 'info',
  topic: 'assistant',
  messageKey: 'activity.assistantAnswered',
  params: { chars: 4 },
  detail: 'x'.repeat(2_000),
})

beforeEach(() => {
  installFakeBridge({})
  useActivity.setState({ entries: [], levels: [], topics: [] })
})

describe('the journal in a window of its own', () => {
  /** The reason the window exists: the flyout cuts a detail to three lines, this one does not. */
  it('shows a detail whole, where the flyout clamps it', () => {
    useActivity.setState({ entries: [entry(1, '2026-08-30T08:55:00.000Z')] })

    render(<JournalWindow />)

    expect(screen.getByText('x'.repeat(2_000))).not.toHaveClass('line-clamp-3')
  })

  /**
   * 🛑 `id` is a rowid of the OPEN project's catalogue and restarts at 1 for each: two projects'
   * lines in one list share ids, React hands one row's node to the other, and the virtualiser
   * files that height under the wrong index — which is how rows came to draw over each other.
   */
  it('tells two lines apart when a second project reuses their ids', () => {
    useActivity.setState({
      entries: [entry(1, '2026-08-30T09:00:00.000Z'), entry(1, '2026-08-30T08:00:00.000Z')],
    })

    render(<JournalWindow />)

    expect(screen.getAllByRole('listitem')).toHaveLength(2)
  })
})
