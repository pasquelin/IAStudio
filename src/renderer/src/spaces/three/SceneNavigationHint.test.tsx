import { render, screen } from '@testing-library/react'
import { act } from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { SceneNavigationHint } from './SceneNavigationHint'

beforeEach(() => vi.useFakeTimers())
afterEach(() => vi.useRealTimers())

describe('the keys a flight answers to', () => {
  it('names the keys the moment the mode is armed, since nothing else does', () => {
    render(<SceneNavigationHint speed={null} />)
    expect(screen.getByText('W')).toBeInTheDocument()
    expect(screen.getByText('S')).toBeInTheDocument()
  })

  // A legend that never leaves stops being read and becomes scenery.
  it('lets the keys go once they have been read', () => {
    render(<SceneNavigationHint speed={null} />)
    act(() => vi.advanceTimersByTime(10_000))
    expect(screen.queryByText('W')).not.toBeInTheDocument()
  })

  // The figure outlives the keys: it moves under the hand, and vanishing mid-flick would hide it.
  it('keeps showing the speed after the keys have gone', () => {
    render(<SceneNavigationHint speed={12} />)
    act(() => vi.advanceTimersByTime(10_000))
    expect(screen.getByText(/12/)).toBeInTheDocument()
  })

  it('shows no speed until the wheel has set one', () => {
    render(<SceneNavigationHint speed={null} />)
    expect(screen.queryByText(/m\/s/)).not.toBeInTheDocument()
  })

  // An empty translucent panel left floating over the viewport is what this refuses.
  it('leaves nothing behind once the keys have gone and no speed was set', () => {
    const { container } = render(<SceneNavigationHint speed={null} />)
    act(() => vi.advanceTimersByTime(10_000))
    expect(container).toBeEmptyDOMElement()
  })
})
