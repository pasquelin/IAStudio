import { render } from '@testing-library/react'
import { act } from 'react'
import { describe, expect, it, vi } from 'vitest'
import { createSkyboxContent } from '@shared/domain/skybox'
import { useSkyboxes } from '@/stores/skyboxes'
import { useSkyRefresh } from './useSkyRefresh'

function Host({ refresh }: { refresh: () => void }) {
  useSkyRefresh(refresh)
  return null
}

const edited = () => useSkyboxes.setState({ states: { 'sky-1': createSkyboxContent() } })

describe('useSkyRefresh', () => {
  /**
   * The other half of « edit the sky and the scene follows »: a scene NAMES a document, and
   * turning its sun moves no asset id — so `useShelfRefresh` never fires, and the viewport went
   * on lighting from what the sky held when the scene was last built.
   */
  it('tells the engine to light again whenever an open sky changes', () => {
    const refresh = vi.fn()
    render(<Host refresh={refresh} />)
    refresh.mockClear()

    act(edited)

    expect(refresh).toHaveBeenCalledTimes(1)
  })

  // A gizmo drag re-renders the inspector on every frame, and the viewport beside it has no
  // business repainting for a subscription that usually finds nothing.
  it('fires without re-rendering the document that asked for it', () => {
    const rendered = vi.fn()
    function Counting() {
      rendered()
      useSkyRefresh(() => {})
      return null
    }

    render(<Counting />)
    rendered.mockClear()

    act(edited)

    expect(rendered).not.toHaveBeenCalled()
  })

  it('does not fire again for a caller that merely re-rendered', () => {
    const refresh = vi.fn()
    const { rerender } = render(<Host refresh={() => refresh()} />)
    refresh.mockClear()

    rerender(<Host refresh={() => refresh()} />)

    expect(refresh).not.toHaveBeenCalled()
  })
})
