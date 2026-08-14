import { fireEvent, render, screen } from '@testing-library/react'
import { beforeEach, describe, expect, it } from 'vitest'
import type { Asset } from '@shared/domain/asset'
import { ASSET_DRAG_TYPE } from '@/helpers/asset-drag'
import { dragTransfer } from '@/helpers/drag-fixtures'
import { fakeMenu } from '@/helpers/menu-fixtures'
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

let menu = fakeMenu()

describe('what a tile in the shelf answers to', () => {
  beforeEach(() => {
    useDocuments.setState({ documents: {}, activeId: null })
    useSelection.getState().clear()
    menu = fakeMenu()
    installFakeBridge({ menu: menu.bridge })
  })

  it('announces both the asset and its kind, so a target can refuse before the drop', () => {
    const dataTransfer = dragTransfer()

    fireEvent.dragStart(tile(), { dataTransfer })

    expect(dataTransfer.getData(ASSET_DRAG_TYPE)).toBe('asset_1')
    expect(dataTransfer.types).toContain(`${ASSET_DRAG_TYPE}+image`)
  })

  // Where it appears is the system's business now; that one is raised at all is this one's.
  it('raises a menu on a right-click', () => {
    fireEvent.contextMenu(tile())

    expect(menu.labels()).not.toEqual([])
  })

  // Selected first, or the shelf would highlight one asset while the menu names another.
  it('takes the selection before opening its menu', () => {
    useSelection.getState().selectAssets(['asset_9'])

    fireEvent.contextMenu(tile())

    expect(selected()).toEqual(['asset_1'])
  })

  // A drag can start without a click, and the shelf must light up what is flying.
  it('takes the selection when a drag starts', () => {
    useSelection.getState().selectAssets(['asset_9'])

    fireEvent.dragStart(tile(), { dataTransfer: dragTransfer() })

    expect(selected()).toEqual(['asset_1'])
  })

  /**
   * The press belongs to the collection now. Selecting here as well moved the anchor before the
   * cell's own click could read it, so a shift-click could never extend a range — and a row that
   * wired its own gestures is exactly what kept the shelf out of the tab order.
   */
  it('leaves a plain press to the collection', () => {
    useSelection.getState().selectAssets(['asset_9'])

    fireEvent.pointerDown(tile())

    expect(selected()).toEqual(['asset_9'])
    expect(menu.raised).toEqual([])
  })
})
