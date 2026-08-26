import { render } from '@testing-library/react'
import { act } from 'react'
import { describe, expect, it, vi } from 'vitest'
import { newMaterial } from '@/engines/material/materialState'
import { useMaterials } from '@/stores/materials'
import { useMaterialRefresh } from './useMaterialRefresh'

function Host({ refresh }: { refresh: () => void }) {
  useMaterialRefresh(refresh)
  return null
}

const edited = () => useMaterials.setState({ states: { 'mat-1': newMaterial() } })

describe('useMaterialRefresh', () => {
  /**
   * The other half of « edit the material and the model follows »: a model NAMES a document, and
   * swapping a channel of it moves no asset id — so `useShelfRefresh` never fires, and the
   * viewport went on drawing what the material held when the scene was last built.
   */
  it('tells the engine to dress again whenever an open material changes', () => {
    const refresh = vi.fn()
    render(<Host refresh={refresh} />)
    refresh.mockClear()

    act(edited)

    expect(refresh).toHaveBeenCalledTimes(1)
  })

  // Same reason as the shelf's: a gizmo drag re-renders the inspector on every frame, and the
  // viewport beside it has no business repainting for a subscription that usually finds nothing.
  it('fires without re-rendering the document that asked for it', () => {
    const rendered = vi.fn()
    function Counting() {
      rendered()
      useMaterialRefresh(() => {})
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
