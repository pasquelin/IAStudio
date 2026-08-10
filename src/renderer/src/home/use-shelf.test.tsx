import { act, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { installIntersectionObserver } from '@/test-setup'
import { useDeferredShelf, useShelf } from './use-shelf'

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

function Band({
  read,
  source = 'key',
  showState = false,
}: {
  read: () => Promise<string | null>
  source?: string
  /** Off by default: two tests read `container.firstElementChild`, which a probe would occupy. */
  showState?: boolean
}) {
  const { value, state, marker } = useDeferredShelf<string | null>(null, read, source)
  return (
    <>
      {showState && <span data-testid="state">{state}</span>}
      {value === null ? marker : <p>{value}</p>}
    </>
  )
}

describe('a shelf that waits to be reached', () => {
  it('reads nothing while the band is still below the fold', () => {
    installIntersectionObserver({ eager: false })
    const read = vi.fn(() => Promise.resolve('spent'))

    render(<Band read={read} />)

    expect(read).not.toHaveBeenCalled()
  })

  it('keeps something on screen to be scrolled to, or it could never be reached', () => {
    // The marker is the whole mechanism: a band that renders nothing has nothing to observe,
    // and its read would never happen at all.
    installIntersectionObserver({ eager: false })
    const { container } = render(<Band read={() => Promise.resolve('spent')} />)

    expect(container.firstElementChild).not.toBeNull()
  })

  it('reads once the band has been reached', async () => {
    const { reveal } = installIntersectionObserver({ eager: false })
    const read = vi.fn(() => Promise.resolve('spent'))

    render(<Band read={read} />)
    act(() => reveal())

    expect(await screen.findByText('spent')).toBeInTheDocument()
    expect(read).toHaveBeenCalledTimes(1)
  })

  it('takes no room once it has been seen and has nothing to say', async () => {
    // The home lays its sections out with a gap, and a marker left behind would take one — two
    // silent bands would then leave a band's worth of blank between the ones that do speak.
    const { reveal } = installIntersectionObserver({ eager: false })
    const { container } = render(<Band read={() => Promise.resolve(null)} />)

    act(() => reveal())
    await act(async () => {
      await new Promise(done => setTimeout(done, 0))
    })

    expect(container.firstElementChild).toBeNull()
  })

  /**
   * The trap this forecloses: unseen, the read answers `undefined`, which is `ready`. A band
   * that declared itself ready would draw its content instead of the marker — and the marker is
   * what makes it observed, so the band would never load at all.
   */
  it('holds at "reading" while unseen, whatever the unread read answers', () => {
    installIntersectionObserver({ eager: false })
    render(<Band read={() => Promise.resolve('spent')} showState />)

    expect(screen.getByTestId('state').textContent).toBe('reading')
  })

  it('reads again when what it reads under changes, having already been seen', async () => {
    // What the retry of a refused band relies on: `seen` is latched, so a new source has to be
    // enough on its own to start a second read.
    const { reveal } = installIntersectionObserver({ eager: false })
    const read = vi.fn(() => Promise.resolve('spent'))

    const { rerender } = render(<Band read={read} source="first" />)
    act(() => reveal())
    expect(await screen.findByText('spent')).toBeInTheDocument()

    rerender(<Band read={read} source="second" />)

    await vi.waitFor(() => expect(read).toHaveBeenCalledTimes(2))
  })
})
