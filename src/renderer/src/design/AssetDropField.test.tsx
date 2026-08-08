import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { ASSET_DRAG_TYPE } from '@/helpers/asset-drag'
import { dragTransfer } from '@/helpers/drag-fixtures'
import { AssetDropField } from './AssetDropField'

/** What `register` hands a control, reduced to what this field touches. */
function registration(onChange = vi.fn()) {
  return { name: 'image', onChange, onBlur: vi.fn(), ref: vi.fn() }
}

function drop(target: Element, assetId: string): void {
  const transfer = dragTransfer()
  transfer.setData(ASSET_DRAG_TYPE, assetId)
  fireEvent.drop(target, { dataTransfer: transfer })
}

describe('AssetDropField', () => {
  it('takes the id of a picture dropped on it', () => {
    const onChange = vi.fn()
    const { container } = render(
      <AssetDropField registration={registration(onChange)} placeholder="Drop one" />,
    )

    const surface = container.firstElementChild
    expect(surface).not.toBeNull()
    if (surface) drop(surface, 'asset-7')

    expect(onChange).toHaveBeenCalledWith({ target: { name: 'image', value: 'asset-7' } })
  })

  it('shows the picture once one is chosen', () => {
    const { container } = render(
      <AssetDropField registration={registration()} initial="asset-7" placeholder="Drop one" />,
    )

    expect(container.querySelector('img')).not.toBeNull()
  })

  // Never a form that disappears: an id can still be pasted, which is the fallback the invariant
  // asks for when nothing is dropped.
  it('keeps a field one can type into', () => {
    render(<AssetDropField registration={registration()} placeholder="Drop one" />)

    expect(screen.getByPlaceholderText('Drop one')).toBeInTheDocument()
  })

  it('ignores a drag carrying something that is not one of ours', () => {
    const onChange = vi.fn()
    const { container } = render(
      <AssetDropField registration={registration(onChange)} placeholder="Drop one" />,
    )

    const surface = container.firstElementChild
    if (surface) fireEvent.drop(surface, { dataTransfer: dragTransfer() })

    expect(onChange).not.toHaveBeenCalled()
  })
})
