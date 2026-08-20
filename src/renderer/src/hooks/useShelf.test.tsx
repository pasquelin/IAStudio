import { act, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { useShelf } from './useShelf'

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
  const { value, state, retry } = useShelf(EMPTY, read, deps)
  return (
    <>
      <span data-testid="held">{value.join(',')}</span>
      <span data-testid="state">{state}</span>
      <button type="button" onClick={retry}>
        again
      </button>
    </>
  )
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

/**
 * The half the value could not carry: a refusal and an empty answer both arrive as the initial
 * value, and five bands took themselves off the page on either.
 */
describe('what a shelf says about its read', () => {
  it('is reading until the answer lands, and ready once it has', async () => {
    render(<Shelf read={() => Promise.resolve(['a'])} deps="one" />)

    expect(screen.getByTestId('state').textContent).toBe('reading')
    await vi.waitFor(() => expect(screen.getByTestId('state').textContent).toBe('ready'))
  })

  /**
   * The ordinary case — no project, no bridge — and an answer in itself. Left as `reading` it
   * would draw a wait that never ends on every band without a project.
   */
  it('is ready, not reading, when there was nothing to ask', async () => {
    render(<Shelf read={() => undefined} deps="one" />)

    // A tick, not a round trip: the answer is already known, it is only settled off the render.
    await vi.waitFor(() => expect(screen.getByTestId('state').textContent).toBe('ready'))
  })

  it('is refused when the read rejects, which is the one state worth retrying', async () => {
    render(<Shelf read={() => Promise.reject(new Error('429'))} deps="one" />)

    await vi.waitFor(() => expect(screen.getByTestId('state').textContent).toBe('refused'))
  })

  it('reads again on retry, without the band having to change what it reads under', async () => {
    const read = vi
      .fn<() => Promise<string[]>>()
      .mockRejectedValueOnce(new Error('429'))
      .mockResolvedValueOnce(['landed'])
    render(<Shelf read={read} deps="one" />)
    await vi.waitFor(() => expect(screen.getByTestId('state').textContent).toBe('refused'))

    await act(async () => {
      screen.getByRole('button', { name: 'again' }).click()
    })

    expect(await screen.findByText('landed')).toBeInTheDocument()
    expect(read).toHaveBeenCalledTimes(2)
  })
})

/**
 * The default fake reports everything as on screen at once — jsdom lays nothing out, so there is
 * nothing off it. A suite about DEFERRING has to install the one that waits to be told.
 */
const REAL = globalThis.IntersectionObserver

afterEach(() => {
  globalThis.IntersectionObserver = REAL
})
