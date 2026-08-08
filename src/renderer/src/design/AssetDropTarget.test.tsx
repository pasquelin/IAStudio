import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { startAssetDrag } from '@/helpers/asset-drag'
import { dragTransfer } from '@/helpers/drag-fixtures'
import { AssetDropTarget } from './AssetDropTarget'

function dragging(type: 'image' | 'audio' | 'mesh'): DataTransfer {
  const dataTransfer = dragTransfer()
  startAssetDrag({ dataTransfer }, { id: 'asset_1', type })
  return dataTransfer
}

function target(accepts: (type: string | null) => boolean, onDrop = vi.fn()) {
  render(
    <AssetDropTarget accepts={accepts} onDrop={onDrop}>
      <span>slot</span>
    </AssetDropTarget>,
  )
  return { surface: screen.getByText('slot').parentElement, onDrop }
}

describe('a surface an asset can be dropped onto', () => {
  it('takes the drop it accepts', () => {
    const { surface, onDrop } = target(() => true)
    const dataTransfer = dragging('image')

    fireEvent.drop(surface as Element, { dataTransfer })

    expect(onDrop).toHaveBeenCalledWith('asset_1')
  })

  // Only a prevented dragover makes a drop land. Preventing one we would refuse promises
  // something the drop then quietly fails to do.
  it('lets a drop land only when it would accept it', () => {
    const { surface } = target(type => type === 'image')

    const welcome = fireEvent.dragOver(surface as Element, { dataTransfer: dragging('image') })
    const refused = fireEvent.dragOver(surface as Element, { dataTransfer: dragging('audio') })

    // `fireEvent` answers false when the handler called `preventDefault`.
    expect(welcome).toBe(false)
    expect(refused).toBe(true)
  })

  it('never claims a drag that is not ours, so a file from the desktop passes through', () => {
    const { surface } = target(() => true)

    expect(fireEvent.dragOver(surface as Element, { dataTransfer: dragTransfer() })).toBe(true)
  })

  it('reads the kind while the asset is still flying', () => {
    const seen: (string | null)[] = []
    const { surface } = target(type => {
      seen.push(type)
      return true
    })

    fireEvent.dragOver(surface as Element, { dataTransfer: dragging('mesh') })

    expect(seen).toEqual(['mesh'])
  })

  it('accepts a drag that announces no kind rather than refusing it', () => {
    // A drop that silently does nothing is worse than one that lands somewhere sensible.
    const seen: (string | null)[] = []
    const dataTransfer = dragTransfer()
    dataTransfer.setData('application/x-scenario-asset', 'asset_1')

    const { surface } = target(type => {
      seen.push(type)
      return type === null
    })
    const answered = fireEvent.dragOver(surface as Element, { dataTransfer })

    expect(seen).toEqual([null])
    expect(answered).toBe(false)
  })
})
