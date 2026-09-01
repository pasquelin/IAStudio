import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { CANVAS_MAX_SCALE, CANVAS_MIN_SCALE } from '@/engines/canvas/viewport'
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
  // comma between the digits. Spelled by code point, because a non-breaking space typed by hand
  // is indistinguishable from an ordinary one in a source file.
  it('punctuates the way the language does', () => {
    expect(zoomLabel(0.5, 'fr')).toBe('50 %')
    expect(zoomLabel(0.037, 'fr')).toBe('3,7 %')
  })
})

describe('ZoomBar', () => {
  /**
   * The readout is the one button of the bar whose word is on screen, so its accessible name has
   * to OPEN with that word: a name of "Zoom" over a button reading "78,9 %" is one nobody can ask
   * for out loud (WCAG SC 2.5.3).
   *
   * Read off `textContent` rather than through a matcher: every query of the library normalizes
   * whitespace, which folds the very space the label above is about.
   */
  it('shows the zoom, and is named by what it shows', () => {
    mount(0.789)

    const readout = screen.getByRole('button', { name: /taille réelle/ })
    expect(readout.textContent).toBe(zoomLabel(0.789, 'fr'))
    expect(readout.getAttribute('aria-label')?.startsWith(zoomLabel(0.789, 'fr'))).toBe(true)
  })

  it('calls each of the four ways out', async () => {
    const handlers = mount(1)

    await userEvent.click(screen.getByRole('button', { name: /Zoom avant/ }))
    await userEvent.click(screen.getByRole('button', { name: /Zoom arrière/ }))
    await userEvent.click(screen.getByRole('button', { name: /Ajuster/ }))
    await userEvent.click(screen.getByRole('button', { name: /taille réelle/ }))

    expect(handlers.onZoomIn).toHaveBeenCalledOnce()
    expect(handlers.onZoomOut).toHaveBeenCalledOnce()
    expect(handlers.onFit).toHaveBeenCalledOnce()
    expect(handlers.onActual).toHaveBeenCalledOnce()
  })

  it('stops offering a zoom the renderer cannot go to', () => {
    mount(CANVAS_MAX_SCALE)
    expect(screen.getByRole('button', { name: /Zoom avant/ })).toBeDisabled()
  })

  it('stops offering a zoom out at the far end too', () => {
    mount(CANVAS_MIN_SCALE)
    expect(screen.getByRole('button', { name: /Zoom arrière/ })).toBeDisabled()
  })
})
