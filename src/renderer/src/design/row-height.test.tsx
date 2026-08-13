import { renderHook } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'
import { refreshPalette } from '@/engines/core/palette'
import { FILLED_ROW_HEIGHT, LIST_ROW_HEIGHT, STACKED_ROW_HEIGHT } from './styles'
import { useRowHeight, type RowHeight } from './virtual'

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
  declare('--sc-row-filled', null)
})

// `RowHeight` itself, never a copy of its members: the union grew a third shape and a hand-written
// one here would have gone on compiling while this suite said nothing about it.
const height = (shape: RowHeight): number => renderHook(() => useRowHeight(shape)).result.current

describe('how tall a list row is', () => {
  it('reads the control gauge for one line of text', () => {
    declare('--sc-control', '24px')

    expect(height('control')).toBe(24)
  })

  // The one the explorer was missing — `index.css` writes what a stacked row costs, beside the
  // gauge that answers for it.
  it('reads the taller gauge for a name stacked over a subtitle', () => {
    declare('--sc-control', '24px')
    declare('--sc-row-stacked', '32px')

    expect(height('stacked')).toBe(32)
  })

  /**
   * The same two steps of text, with a fill behind them: its own gauge, because raising the shared
   * one for the home's filled rows is exactly what loosened the explorer and the documents panel.
   */
  it('reads a gauge of its own for a row painted edge to edge', () => {
    declare('--sc-row-stacked', '32px')
    declare('--sc-row-filled', '38px')

    expect(height('filled')).toBe(38)
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
    expect(height('filled')).toBe(FILLED_ROW_HEIGHT)
  })
})
