import { renderHook } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'
import { refreshPalette } from '@/engines/core/palette'
import { LIST_ROW_HEIGHT, STACKED_ROW_HEIGHT } from '@/design/styles'
import { useRowHeight } from './useRowHeight'

function declare(gauge: string, value: string | null): void {
  const root = document.documentElement
  if (value === null) root.style.removeProperty(gauge)
  else root.style.setProperty(gauge, value)
  // The token cache is module-level and shared: without this the next read answers the last test.
  refreshPalette()
}

afterEach(() => {
  declare('--sc-control', null)
  declare('--sc-row-stacked', null)
})

const height = (shape: 'control' | 'stacked' | number): number =>
  renderHook(() => useRowHeight(shape)).result.current

describe('how tall a list row is', () => {
  it('reads the control gauge for one line of text', () => {
    declare('--sc-control', '24px')

    expect(height('control')).toBe(24)
  })

  /**
   * The one the explorer was missing. Two steps of `leading-tight` text are 27.5px: they fill a
   * 28px control row edge to edge and overflow a compact one, which is 24px.
   */
  it('reads the taller gauge for a name stacked over a subtitle', () => {
    declare('--sc-control', '24px')
    declare('--sc-row-stacked', '32px')

    expect(height('stacked')).toBe(32)
  })

  // A shape a gauge cannot describe is the only reason to pass a number at all.
  it('takes a number as it is', () => {
    declare('--sc-control', '24px')

    expect(height(48)).toBe(48)
  })

  // The shipped numbers stand in when the stylesheet is not there to be read — as under a suite.
  it('falls back to the shipped heights when no gauge is declared', () => {
    expect(height('control')).toBe(LIST_ROW_HEIGHT)
    expect(height('stacked')).toBe(STACKED_ROW_HEIGHT)
  })
})
