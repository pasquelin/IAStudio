import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { MAX_SCALE, MIN_SCALE } from '@/engines/canvas/viewport'
import { ZoomBar, zoomLabel } from './ZoomBar'

function mount(scale: number) {
  const handlers = {
    onZoomIn: vi.fn(),
    onZoomOut: vi.fn(),
    onFit: vi.fn(),
    onActual: vi.fn(),
  }
  const shortcuts = { zoomIn: '⌘=', zoomOut: '⌘−', fit: '⌘0', actual: '⌘1' }
  render(<ZoomBar scale={scale} shortcuts={shortcuts} {...handlers} />)
  return handlers
}

describe('zoomLabel', () => {
  it('reads in whole percents from 100% up', () => {
    expect(zoomLabel(1, 'en')).toBe('100%')
    expect(zoomLabel(12.5, 'en')).toBe('1250%')
  })

  // Below 100% every editor keeps a decimal: 3% and 3.7% are different framings of a large canvas.
  it('keeps one decimal below 100%', () => {
    expect(zoomLabel(0.037, 'en')).toBe('3.7%')
  })

  // The separator is the language's, not the bar's: French writes U+00A0 before the sign, and a
  // comma between the digits — the hand-written version printed `3.7 %` to a French reader.
  it('punctuates the way the language does', () => {
    expect(zoomLabel(0.5, 'fr')).toBe('50\u00a0%')
    expect(zoomLabel(0.037, 'fr')).toBe('3,7\u00a0%')
  })
})

describe('ZoomBar', () => {
  it('shows where the zoom is', () => {
    mount(0.5)
    expect(screen.getByText('50 %')).toBeInTheDocument()
  })

  it('calls each of the four ways out', async () => {
    const handlers = mount(1)

    await userEvent.click(screen.getByRole('button', { name: /Zoom avant/ }))
    await userEvent.click(screen.getByRole('button', { name: /Zoom arrière/ }))
    await userEvent.click(screen.getByRole('button', { name: /Ajuster/ }))
    // The readout's accessible name carries its key, like every other button of the bars.
    await userEvent.click(screen.getByRole('button', { name: 'Zoom (⌘1)' }))

    expect(handlers.onZoomIn).toHaveBeenCalledOnce()
    expect(handlers.onZoomOut).toHaveBeenCalledOnce()
    expect(handlers.onFit).toHaveBeenCalledOnce()
    expect(handlers.onActual).toHaveBeenCalledOnce()
  })

  it('stops offering a zoom the renderer cannot go to', () => {
    mount(MAX_SCALE)
    expect(screen.getByRole('button', { name: /Zoom avant/ })).toBeDisabled()
  })

  it('stops offering a zoom out at the far end too', () => {
    mount(MIN_SCALE)
    expect(screen.getByRole('button', { name: /Zoom arrière/ })).toBeDisabled()
  })
})
