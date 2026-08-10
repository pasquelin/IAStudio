import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { Carousel } from './Carousel'
import { SHELF_OVERLAY } from './styles'

type Card = { id: string; name: string }

/** Wider than the 640 px viewport the test setup stubs, so the rail has pages to scroll. */
const RAIL_WIDTH = 3200

function cards(count: number): Card[] {
  return Array.from({ length: count }, (_, index) => ({
    id: `card_${index}`,
    name: `Card ${index}`,
  }))
}

const scrollBy = vi.fn()
const scrollTo = vi.fn()

beforeEach(() => {
  // jsdom runs no layout and implements neither scroll method. The setup file already stubs
  // widths; these two are what the arrows and the dots actually call.
  Object.defineProperty(HTMLElement.prototype, 'scrollWidth', {
    configurable: true,
    value: RAIL_WIDTH,
  })
  Object.defineProperty(HTMLElement.prototype, 'scrollBy', { configurable: true, value: scrollBy })
  Object.defineProperty(HTMLElement.prototype, 'scrollTo', { configurable: true, value: scrollTo })
})

afterEach(() => {
  scrollBy.mockClear()
  scrollTo.mockClear()
})

function renderCarousel(items: Card[], props = {}) {
  return render(
    <Carousel
      items={items}
      renderCard={item => <span>{item.name}</span>}
      itemWidth={160}
      itemHeight={120}
      label="Shelf"
      {...props}
    />,
  )
}

describe('Carousel', () => {
  it('renders a window over the items rather than all of them', () => {
    renderCarousel(cards(500))

    const rendered = screen.getAllByText(/^Card \d+$/)
    expect(rendered.length).toBeGreaterThan(0)
    expect(rendered.length).toBeLessThan(100)
    expect(screen.getByText('Card 0')).toBeInTheDocument()
  })

  it('shows what the caller gives for an empty shelf, and no rail', () => {
    renderCarousel([], { empty: <span>Nothing here yet</span> })

    expect(screen.getByText('Nothing here yet')).toBeInTheDocument()
    expect(screen.queryByRole('region', { name: 'Shelf' })).not.toBeInTheDocument()
  })
})

/**
 * The rail measures itself one frame after it is laid out — reading three layout properties on
 * every scroll event would force a reflow a hundred times a second. So the arrows and the dots
 * are awaited, never read synchronously.
 */
describe('the arrows', () => {
  it('hides the one pointing at an end the rail has reached', async () => {
    renderCarousel(cards(500))

    // The rail starts at its left end, so only the forward arrow has anything to point at.
    expect(await screen.findByRole('button', { name: 'Faire défiler' })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Revenir en arrière' })).not.toBeInTheDocument()
  })

  it('scrolls by a page, keeping a sliver of the previous one', async () => {
    renderCarousel(cards(500))

    await userEvent.click(await screen.findByRole('button', { name: 'Faire défiler' }))

    const asked: number = scrollBy.mock.calls.at(-1)?.[0].left
    // A page of the 640 px viewport, less the overlap — never a single card.
    expect(asked).toBeGreaterThan(160)
    expect(asked).toBeLessThan(640)
  })

  it('reads the shelf overlay skin rather than carrying its own copy', async () => {
    renderCarousel(cards(500))

    const arrow = await screen.findByRole('button', { name: 'Faire défiler' })
    expect(arrow.className).toContain(SHELF_OVERLAY)
  })
})

describe('the page dots', () => {
  it('offers one per page and marks the one being read', async () => {
    renderCarousel(cards(500))

    // 3200 px of rail over a 640 px viewport.
    const dots = await screen.findAllByRole('button', { name: /^Page \d+$/ })
    expect(dots).toHaveLength(5)
    expect(dots[0]).toHaveAttribute('aria-current', 'true')
  })

  it('scrolls to the page it names', async () => {
    renderCarousel(cards(500))

    await userEvent.click(await screen.findByRole('button', { name: 'Page 3' }))

    expect(scrollTo).toHaveBeenCalledWith({ left: 640 * 2 })
  })
})

describe('the keyboard', () => {
  it('moves the rail by a card, and jumps to either end', async () => {
    renderCarousel(cards(500))
    const rail = screen.getByRole('region', { name: 'Shelf' })

    rail.focus()
    await userEvent.keyboard('{ArrowRight}{ArrowLeft}')
    expect(scrollBy).toHaveBeenCalledTimes(2)

    await userEvent.keyboard('{End}{Home}')
    expect(scrollTo).toHaveBeenCalledWith({ left: RAIL_WIDTH })
    expect(scrollTo).toHaveBeenCalledWith({ left: 0 })
  })
})

/**
 * The one that guards the reduce-motion setting: naming `behavior` in JavaScript overrides the
 * stylesheet, where `[data-reduce-motion]` turns smooth scrolling off. Every scroll here has to
 * leave the decision to CSS.
 */
describe('reduced motion', () => {
  it('never names a scroll behaviour, leaving it to the stylesheet', async () => {
    renderCarousel(cards(500))
    const rail = screen.getByRole('region', { name: 'Shelf' })

    rail.focus()
    await userEvent.keyboard('{ArrowRight}{End}')
    await userEvent.click(await screen.findByRole('button', { name: 'Page 2' }))

    // The virtualizer scrolls too, and passes `behavior: undefined` — which is the same as
    // saying nothing. What must never appear is a named behaviour.
    for (const call of [...scrollBy.mock.calls, ...scrollTo.mock.calls]) {
      expect(call[0]?.behavior).toBeUndefined()
    }
  })
})

/**
 * A shelf whose items are fetched starts empty, draws no rail, and therefore has nothing to
 * observe. The observer has to be installed when the first item lands, or that shelf keeps its
 * arrows and its dots for good — which is every shelf the home fills from disk.
 */
describe('a shelf that fills up later', () => {
  it('measures itself once it has a rail', async () => {
    const { rerender } = renderCarousel([])

    rerender(
      <Carousel
        items={cards(500)}
        renderCard={item => <span>{item.name}</span>}
        itemWidth={160}
        itemHeight={120}
        label="Shelf"
      />,
    )

    expect(await screen.findByRole('button', { name: 'Faire défiler' })).toBeInTheDocument()
    expect(await screen.findAllByRole('button', { name: /^Page \d+$/ })).toHaveLength(5)
  })
})
