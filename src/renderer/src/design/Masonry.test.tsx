import { render, screen, waitFor } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { Masonry, type MasonryProps } from './Masonry'

type Picture = { id: string; name: string; ratio?: number }

/** The width the layout polyfill reports for anything observed — see `test-setup.ts`. */
const VIEWPORT_WIDTH = 640
const COLUMN_WIDTH = 200
/** What the three columns 640 px yields actually measure, gutters taken out. */
const LANE_WIDTH = (VIEWPORT_WIDTH - 2 * 8) / 3

function pictures(count: number, ratio?: number): Picture[] {
  return Array.from({ length: count }, (_, index) => ({
    id: `pic_${index}`,
    name: `Picture ${index}`,
    ...(ratio === undefined ? {} : { ratio }),
  }))
}

function renderMasonry(items: Picture[], props: Partial<MasonryProps<Picture>> = {}) {
  return render(
    // The home owns the only scroll on the screen, and this grid hangs off it. Inline, because
    // jsdom applies no stylesheet and `scrollParentOf` reads the computed overflow.
    <div style={{ overflowY: 'auto' }}>
      <div style={{ height: 400 }}>a section above, which the grid starts below</div>
      <Masonry
        items={items}
        renderCard={item => <span>{item.name}</span>}
        ratioOf={item => item.ratio}
        columnWidth={COLUMN_WIDTH}
        label="Explore"
        {...props}
      />
    </div>,
  )
}

/**
 * The cells the grid actually laid out, which is what carries the reserved place. Picked by
 * their transform: it is the one thing only a positioned cell has, and the sizer around them
 * carries a height of its own that would otherwise be read as the first cell's.
 */
function cells(): HTMLElement[] {
  const region = screen.getByRole('region', { name: 'Explore' })
  return [...region.querySelectorAll<HTMLElement>('[style*="transform"]')]
}

describe('Masonry', () => {
  it('reserves each place from the asset dimensions, before any picture is fetched', async () => {
    // Nothing is measured from the DOM: this is the whole reason the page never jumps as the
    // pictures land. A 2:1 picture is half as tall as its column is wide.
    renderMasonry(pictures(6, 2))

    await waitFor(() => expect(cells().length).toBeGreaterThan(0))
    expect(cells()[0]?.style.height).toBe(`${LANE_WIDTH / 2}px`)
  })

  it('falls back to a square when the API stated no dimensions', async () => {
    renderMasonry(pictures(6))

    await waitFor(() => expect(cells().length).toBeGreaterThan(0))
    expect(cells()[0]?.style.height).toBe(`${LANE_WIDTH}px`)
  })

  it('refuses a degenerate ratio rather than collapsing the cell', async () => {
    // A zero would stack every item at one offset and hide the whole feed behind the first.
    renderMasonry(pictures(6, 0))

    await waitFor(() => expect(cells().length).toBeGreaterThan(0))
    expect(cells()[0]?.style.height).toBe(`${LANE_WIDTH}px`)
  })

  it('never draws a letterbox strip, however flat the picture is', async () => {
    // Seamless textures are published at 3584×512. Reserved faithfully, they are a few pixels
    // tall beside square tiles and the column reads as a list of captions.
    renderMasonry(pictures(6, 7))

    await waitFor(() => expect(cells().length).toBeGreaterThan(0))
    expect(cells()[0]?.style.height).toBe(`${LANE_WIDTH / 2}px`)
  })

  it('never draws a tower either', async () => {
    renderMasonry(pictures(6, 0.1))

    await waitFor(() => expect(cells().length).toBeGreaterThan(0))
    expect(cells()[0]?.style.height).toBe(`${LANE_WIDTH / 0.5}px`)
  })

  it('lays the items out in columns of free height', async () => {
    renderMasonry(pictures(9, 1))

    await waitFor(() => expect(cells().length).toBeGreaterThan(2))
    const lefts = new Set(cells().map(cell => cell.style.left))
    expect(lefts.size).toBe(3)
  })

  it('renders a window over the items rather than all of them', async () => {
    renderMasonry(pictures(600, 1))

    await waitFor(() => expect(screen.queryByText('Picture 0')).not.toBeNull())
    expect(screen.getAllByText(/^Picture \d+$/).length).toBeLessThan(100)
  })

  it('asks for the next page before the end is on screen', async () => {
    const onReachEnd = vi.fn()
    // Few enough that the whole grid fits the viewport: the end is within the prefetch window.
    renderMasonry(pictures(3, 1), { onReachEnd })

    await waitFor(() => expect(onReachEnd).toHaveBeenCalled())
  })

  it('does not ask for more when there is nothing at all', async () => {
    const onReachEnd = vi.fn()
    // An empty grid is not the end of one: asking would loop until the source ran dry.
    renderMasonry([], { onReachEnd, empty: <p>nothing published</p> })

    await waitFor(() => expect(screen.getByText('nothing published')).toBeInTheDocument())
    expect(onReachEnd).not.toHaveBeenCalled()
  })

  it('shows what the caller hands over in place of an empty grid', () => {
    renderMasonry([], { empty: <p>nothing published</p> })
    expect(screen.getByText('nothing published')).toBeInTheDocument()
  })
})
