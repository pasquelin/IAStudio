import { renderHook } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { DEFAULT_CANVAS } from '@/engines/canvas/canvasState'
import { installCanvas } from '@/stores/canvas-fixtures'
import { usePixelArtGrid } from './usePixelArtGrid'

/**
 * 🛑 The one case worth its own file: composing the answer without `useShallow` gave React a new
 * object on every read, and this very render threw « Maximum update depth exceeded » at 54.
 * Every gate was green on it — no suite mounted the generator over a document on a grid.
 */
describe('the grid of the image in front', () => {
  it('answers the artwork in cells, and settles', () => {
    installCanvas('doc-1', { ...DEFAULT_CANVAS, width: 512, height: 256, pixelCell: 16 })

    const { result } = renderHook(() => usePixelArtGrid())

    expect(result.current).toEqual({ columns: 32, rows: 16 })
  })

  it('answers nothing for a document off the grid', () => {
    installCanvas('doc-1', { ...DEFAULT_CANVAS, pixelCell: null })

    expect(renderHook(() => usePixelArtGrid()).result.current).toBeNull()
  })
})
