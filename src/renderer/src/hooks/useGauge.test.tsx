import { act, renderHook } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'
import { refreshPalette } from '@/engines/core/palette'
import { useGauge } from './useGauge'

const GAUGE = '--sc-control'

function setGauge(value: string | null): void {
  const root = document.documentElement
  if (value === null) root.style.removeProperty(GAUGE)
  else root.style.setProperty(GAUGE, value)
  // The token cache is module-level and shared: without this the next read answers the last test.
  refreshPalette()
}

afterEach(() => setGauge(null))

describe('useGauge', () => {
  it('reads the pixels the stylesheet declares', () => {
    setGauge('24px')

    expect(renderHook(() => useGauge(GAUGE, 28)).result.current).toBe(24)
  })

  /**
   * Re-rendered by the palette itself, with nothing asking it to: the density is published on
   * the root element by `useAppearance`, which no list is subscribed to, so a hook that only
   * re-read on its parent's next render would keep the height of the density just left.
   */
  it('follows the gauge when the density moves, unprompted', () => {
    setGauge('28px')
    const { result } = renderHook(() => useGauge(GAUGE, 99))
    expect(result.current).toBe(28)

    act(() => setGauge('24px'))

    expect(result.current).toBe(24)
  })

  /** Every gauge reads back empty under jsdom, so this is the path the suites actually take. */
  it('falls back when the gauge is not declared', () => {
    expect(renderHook(() => useGauge(GAUGE, 28)).result.current).toBe(28)
  })

  it('falls back on a value that is not a length', () => {
    setGauge('inherit')

    expect(renderHook(() => useGauge(GAUGE, 28)).result.current).toBe(28)
  })

  /**
   * `1.75rem` is `28px` written another way, and `parseFloat` reads it as `1.75`. Taken, a
   * virtualizer estimating under two pixels a row mounts the entire list — measured at 400 rows
   * of a tree: 400 mounted where 37 fit on screen.
   */
  it('falls back on a length that is not in pixels', () => {
    for (const written of ['1.75rem', '50%', '2em', 'calc(28px * 1)']) {
      setGauge(written)

      expect(renderHook(() => useGauge(GAUGE, 28)).result.current, written).toBe(28)
    }
  })

  /** Neither is a height a row can have, and both break the window a virtualizer computes. */
  it('falls back on zero and on a negative length', () => {
    for (const written of ['0px', '-4px']) {
      setGauge(written)

      expect(renderHook(() => useGauge(GAUGE, 28)).result.current, written).toBe(28)
    }
  })
})
