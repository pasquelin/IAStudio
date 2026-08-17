import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { DEFAULT_PANE_VIEWS } from '@/engines/scene/sceneView'
import { ScenePaneGrid } from './ScenePaneGrid'

describe('the four views and their seams', () => {
  /**
   * The accessible name carries the word that is ON SCREEN, and the rank only tells the four
   * apart: a name that read "View 1" over a button reading "Top" is one a voice user cannot
   * reach by saying what they see (WCAG SC 2.5.3).
   */
  it('names each view by the word it shows, then by its rank', () => {
    render(<ScenePaneGrid views={DEFAULT_PANE_VIEWS} onView={vi.fn()} />)

    expect(screen.getByRole('button', { name: 'Perspective — vue 1' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'De dessus — vue 2' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'De face — vue 3' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'De gauche — vue 4' })).toBeInTheDocument()
  })

  it('lets a view be changed to any of the seven, and says which one it is', async () => {
    const onView = vi.fn()
    render(<ScenePaneGrid views={DEFAULT_PANE_VIEWS} onView={onView} />)

    await userEvent.click(screen.getByRole('button', { name: /vue 2/ }))
    await userEvent.click(await screen.findByRole('menuitemradio', { name: /De droite/ }))

    expect(onView).toHaveBeenCalledWith(1, 'right')
  })

  /** Two perspectives and two sides is a layout the user is entitled to ask for. */
  it('offers the free view to a quarter that already holds a side', async () => {
    const onView = vi.fn()
    render(<ScenePaneGrid views={DEFAULT_PANE_VIEWS} onView={onView} />)

    await userEvent.click(screen.getByRole('button', { name: /vue 3/ }))
    await userEvent.click(await screen.findByRole('menuitemradio', { name: /Perspective/ }))

    expect(onView).toHaveBeenCalledWith(2, 'free')
  })

  it('ticks the view a quarter is on', async () => {
    render(<ScenePaneGrid views={DEFAULT_PANE_VIEWS} onView={vi.fn()} />)

    await userEvent.click(screen.getByRole('button', { name: /vue 2/ }))

    expect(await screen.findByRole('menuitemradio', { name: /De dessus/ })).toHaveAttribute(
      'aria-checked',
      'true',
    )
  })

  /** A drag has to reach the canvas underneath; only the labels take the pointer. */
  it('lets the pointer through everywhere but its own buttons', () => {
    const { container } = render(<ScenePaneGrid views={DEFAULT_PANE_VIEWS} onView={vi.fn()} />)

    expect(container.firstElementChild).toHaveClass('pointer-events-none')
    expect(screen.getByRole('button', { name: /vue 1/ })).toHaveClass('pointer-events-auto')
  })

  /** A bare word reads as a caption: the chevron is what says the label opens something. */
  it('shows that the label opens a menu', () => {
    render(<ScenePaneGrid views={DEFAULT_PANE_VIEWS} onView={vi.fn()} />)

    expect(screen.getByRole('button', { name: /vue 1/ }).querySelector('svg')).not.toBeNull()
  })

  /**
   * A flex child stretches by default, and the label came out as a black column with one letter
   * per line — which is what a viewport four rectangles wide showed on screen.
   */
  it('keeps its label on one line rather than stretching it down the pane', () => {
    render(<ScenePaneGrid views={DEFAULT_PANE_VIEWS} onView={vi.fn()} />)

    const button = screen.getByRole('button', { name: /vue 1/ })
    expect(button).toHaveClass('whitespace-nowrap')
    expect(button.parentElement).toHaveClass('items-start')
  })

  /** The space keeps its tool rail down the left edge: a label in that corner sits behind it. */
  it('keeps its labels out of the corner the toolbar occupies', () => {
    render(<ScenePaneGrid views={DEFAULT_PANE_VIEWS} onView={vi.fn()} />)

    const cell = screen.getByRole('button', { name: /vue 1/ }).parentElement
    expect(cell).toHaveClass('justify-end')
  })

  it('falls back to the free view for a quarter nothing has set', () => {
    render(<ScenePaneGrid views={[]} onView={vi.fn()} />)

    expect(screen.getByRole('button', { name: /vue 1/ })).toHaveTextContent('Perspective')
  })
})
