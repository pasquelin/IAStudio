import { fireEvent, render, screen } from '@testing-library/react'
import { beforeEach, describe, expect, it } from 'vitest'
import type { Asset } from '@shared/domain/asset'
import { ASSET_DRAG_TYPE } from '@/helpers/asset-drag'
import { dragTransfer } from '@/helpers/drag-fixtures'
import { installFakeBridge } from '@/services/fake-bridge'
import { useDocuments } from '@/stores/documents'
import { useSelection } from '@/stores/selection'
import { DraggableAsset } from './DraggableAsset'

const selected = (): readonly string[] => {
  const { selection } = useSelection.getState()
  return selection.kind === 'none' ? [] : selection.ids
}

const asset: Asset = {
  id: 'asset_1',
  name: 'Boulder',
  type: 'image',
  location: 'local',
  tags: [],
  createdAt: '2026-08-06T10:00:00.000Z',
}

function tile() {
  render(
    <DraggableAsset asset={asset}>
      <span>Boulder</span>
    </DraggableAsset>,
  )
  return screen.getByText('Boulder').parentElement as Element
}

describe('what a tile in the shelf answers to', () => {
  beforeEach(() => {
    useDocuments.setState({ documents: {}, activeId: null })
    useSelection.getState().clear()
    installFakeBridge()
  })

  it('announces both the asset and its kind, so a target can refuse before the drop', () => {
    const dataTransfer = dragTransfer()

    fireEvent.dragStart(tile(), { dataTransfer })

    expect(dataTransfer.getData(ASSET_DRAG_TYPE)).toBe('asset_1')
    expect(dataTransfer.types).toContain(`${ASSET_DRAG_TYPE}+image`)
  })

  it('opens a menu where the pointer was', () => {
    fireEvent.contextMenu(tile(), { clientX: 120, clientY: 80 })

    const menu = screen.getByRole('menu')
    expect(menu.style.left).toBe('120px')
    expect(menu.style.top).toBe('80px')
  })

  // Selected first, or the shelf would highlight one asset while the menu names another.
  it('takes the selection before opening its menu', () => {
    useSelection.getState().selectAssets(['asset_9'])

    fireEvent.contextMenu(tile(), { clientX: 10, clientY: 10 })

    expect(selected()).toEqual(['asset_1'])
  })

  it('selects on a plain press too, without opening anything', () => {
    fireEvent.pointerDown(tile())

    expect(selected()).toEqual(['asset_1'])
    expect(screen.queryByRole('menu')).not.toBeInTheDocument()
  })

  it('carries no menu until one is asked for', () => {
    tile()

    expect(screen.queryByRole('menu')).not.toBeInTheDocument()
  })

  it('takes its menu away once it closes', () => {
    fireEvent.contextMenu(tile(), { clientX: 10, clientY: 10 })
    expect(screen.getByRole('menu')).toBeInTheDocument()

    fireEvent.keyDown(document, { key: 'Escape' })

    expect(screen.queryByRole('menu')).not.toBeInTheDocument()
  })
})
