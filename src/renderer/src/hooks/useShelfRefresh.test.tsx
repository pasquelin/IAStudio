import { render } from '@testing-library/react'
import { act } from 'react'
import { describe, expect, it, vi } from 'vitest'
import { useAssets } from '@/stores/assets'
import { useShelfRefresh } from './useShelfRefresh'

function Host({ refresh }: { refresh: () => void }) {
  useShelfRefresh(refresh)
  return null
}

describe('useShelfRefresh', () => {
  it('tells the engine to ask again whenever the catalogue is re-read', () => {
    const refresh = vi.fn()
    render(<Host refresh={refresh} />)
    refresh.mockClear()

    act(() => useAssets.setState({ items: [] }))

    expect(refresh).toHaveBeenCalledTimes(1)
  })

  /**
   * Every caller writes an inline arrow — `() => engine.current?.refreshMaps()` — so a callback
   * read as a dependency would refresh on every render of its component instead of on a write to
   * the shelf, and a document dragging its sun would re-ask for every picture per frame.
   */
  it('does not fire again for a caller that merely re-rendered', () => {
    const refresh = vi.fn()
    const { rerender } = render(<Host refresh={() => refresh()} />)
    refresh.mockClear()

    rerender(<Host refresh={() => refresh()} />)

    expect(refresh).not.toHaveBeenCalled()
  })
})
