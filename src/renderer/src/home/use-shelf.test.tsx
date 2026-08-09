import { render, screen } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { useShelf } from './use-shelf'

const EMPTY: readonly string[] = []

function Shelf({
  read,
  key: _ignored,
  deps,
}: {
  read: () => Promise<string[]> | undefined
  key?: string
  deps: string
}) {
  const held = useShelf(EMPTY, read, deps)
  return <span data-testid="held">{held.join(',')}</span>
}

beforeEach(() => {
  vi.restoreAllMocks()
})

describe('what a shelf holds', () => {
  it('shows what the read answered', async () => {
    render(<Shelf read={() => Promise.resolve(['a'])} deps="one" />)

    expect(await screen.findByText('a')).toBeInTheDocument()
  })

  /**
   * A shelf read under one project must not go on describing it under the next. The home stays
   * up while a recent project is opened from it, so this is the ordinary path, not an edge.
   */
  it('empties before reading again, rather than describing what one has left', async () => {
    let answer: string[] = ['from-the-first']
    const read = () => Promise.resolve(answer)
    const { rerender } = render(<Shelf read={read} deps="one" />)
    await screen.findByText('from-the-first')

    answer = ['from-the-second']
    rerender(<Shelf read={read} deps="two" />)
    // Emptied on the spot: the old rows are gone before the new answer lands.
    expect(screen.getByTestId('held').textContent).toBe('')

    expect(await screen.findByText('from-the-second')).toBeInTheDocument()
  })

  it('empties when the read refuses, rather than keeping a stale answer', async () => {
    const { rerender } = render(<Shelf read={() => Promise.resolve(['held'])} deps="one" />)
    await screen.findByText('held')

    rerender(<Shelf read={() => Promise.reject(new Error('no project'))} deps="two" />)

    await vi.waitFor(() => expect(screen.getByTestId('held').textContent).toBe(''))
  })

  it('holds the initial value when there is no bridge to read through', () => {
    render(<Shelf read={() => undefined} deps="one" />)

    expect(screen.getByTestId('held').textContent).toBe('')
  })
})
