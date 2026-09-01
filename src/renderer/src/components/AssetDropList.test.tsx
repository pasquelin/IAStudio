import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { Asset } from '@shared/domain/asset'
import { startAssetDrag } from '@/helpers/assetDrag'
import { dragTransfer } from '@/helpers/drag-fixtures'
import { useAssets } from '@/stores/assets'
import { AssetDropList } from './AssetDropList'

const view = (id: string, name: string): Asset => ({
  id,
  name,
  type: 'image',
  location: 'local',
  tags: [],
  createdAt: '2026-08-07T10:00:00.000Z',
})

/** What `register` hands a control, reduced to what this field touches. */
function registration(onChange = vi.fn()) {
  return { name: 'files', onChange, onBlur: vi.fn(), ref: vi.fn() }
}

async function drop(target: Element, assetId: string): Promise<void> {
  const dataTransfer = dragTransfer()
  startAssetDrag({ dataTransfer }, { id: assetId, type: 'image' })
  fireEvent.drop(target, { dataTransfer })
  await Promise.resolve()
}

const surfaceOf = (container: HTMLElement): Element => {
  const surface = container.querySelector('[class*="rounded"]')
  if (!surface) throw new Error('the list has no drop surface')
  return surface
}

/**
 * 🛑 A LIST, and their refusal is why: « files or inputs are required for multiview_to_model ».
 * One registration for the whole of it — a field per slot would hand react-hook-form as many
 * refs under one name, and it keeps the last.
 */
describe('AssetDropList', () => {
  beforeEach(() => {
    useAssets.setState({ items: [view('asset-7', 'front.png'), view('asset-8', 'left.png')] })
  })

  it('grows by one for every picture dropped, in the order they arrived', async () => {
    const onChange = vi.fn()
    const { container } = render(
      <AssetDropList registration={registration(onChange)} placeholder="Drop views" />,
    )

    await drop(surfaceOf(container), 'asset-7')
    await drop(surfaceOf(container), 'asset-8')

    await waitFor(() =>
      expect(onChange).toHaveBeenLastCalledWith({
        target: { name: 'files', value: ['asset-7', 'asset-8'] },
      }),
    )
  })

  it('takes one back out without disturbing the others', async () => {
    const onChange = vi.fn()
    render(
      <AssetDropList
        registration={registration(onChange)}
        initial={['asset-7', 'asset-8']}
        placeholder="Drop views"
      />,
    )

    fireEvent.click(screen.getAllByRole('button')[0] as Element)

    await waitFor(() =>
      expect(onChange).toHaveBeenLastCalledWith({ target: { name: 'files', value: ['asset-8'] } }),
    )
  })

  // Two of the same view is not what the endpoint wants, and two children under one key is not
  // what React wants either.
  it('takes the same picture only once, however often it is dropped', async () => {
    const onChange = vi.fn()
    const { container } = render(
      <AssetDropList registration={registration(onChange)} placeholder="Drop views" />,
    )

    await drop(surfaceOf(container), 'asset-7')
    await drop(surfaceOf(container), 'asset-7')

    await waitFor(() =>
      expect(onChange).toHaveBeenLastCalledWith({ target: { name: 'files', value: ['asset-7'] } }),
    )
  })

  it('says what it wants while it holds nothing', () => {
    render(<AssetDropList registration={registration()} placeholder="Drop views" />)

    expect(screen.getByText('Drop views')).toBeInTheDocument()
  })
})
