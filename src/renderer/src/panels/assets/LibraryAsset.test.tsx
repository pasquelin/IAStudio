import { fireEvent, render, screen } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { CloudAsset } from '@shared/domain/cloud-asset'
import { dragTransfer } from '@/helpers/drag-fixtures'
import { installFakeBridge } from '@/services/fake-bridge'
import { useCloud } from '@/stores/cloud'
import { useProject } from '@/stores/project'
import { LibraryAsset } from './LibraryAsset'

const asset: CloudAsset = {
  id: 'asset_remote',
  name: 'skeleton',
  type: 'mesh',
  remoteType: 'img23d',
  ownerId: 'proj_1',
  createdAt: '2026-08-12T11:00:00.000Z',
  updatedAt: '2026-08-12T11:00:00.000Z',
  privacy: 'private',
  tags: [],
  collectionIds: [],
}

function open() {
  render(
    <LibraryAsset asset={asset}>
      <span>tile</span>
    </LibraryAsset>,
  )
  const surface = screen.getByText('tile').parentElement as Element
  fireEvent.contextMenu(surface, { clientX: 10, clientY: 10 })
  return surface
}

const withProject = (path: string | null): void => {
  useProject.setState({
    project:
      path === null
        ? null
        : { path, manifest: { version: 1, name: 'Reel', createdAt: '', updatedAt: '' } },
  })
}

describe('a library line the catalogue does not hold', () => {
  beforeEach(() => {
    useCloud.getState().clear()
    installFakeBridge({})
    withProject('/Users/someone/Reel.scenario')
  })

  it('offers the one thing the line is for', () => {
    open()

    expect(screen.getByRole('menuitem', { name: 'Récupérer dans le projet' })).toBeInTheDocument()
  })

  /**
   * Disabled rather than hidden, as every other menu here: an entry that comes and goes with
   * the context is one nobody can learn. Without a project there is no folder to write into.
   */
  it('greys the entry out when there is nowhere to write the file', () => {
    withProject(null)
    open()

    expect(screen.getByRole('menuitem', { name: 'Récupérer dans le projet' })).toBeDisabled()
  })

  // One transfer at a time is `useCloud`'s own rule; the menu says so rather than starting a
  // second one that the store would silently refuse.
  it('greys the entry out while another transfer is running', () => {
    useCloud.setState({ busy: true })
    open()

    expect(screen.getByRole('menuitem', { name: 'Récupérer dans le projet' })).toBeDisabled()
  })

  /**
   * Dragged like a local one, under the same kind: what a target accepts is the mesh, not where
   * its bytes are. The download happens at the drop, which is what makes the library half of
   * the browser usable rather than a shelf one can only look at.
   */
  it('can be dragged, and announces the kind a target decides on', () => {
    render(
      <LibraryAsset asset={asset}>
        <span>tile</span>
      </LibraryAsset>,
    )
    const dataTransfer = dragTransfer()

    fireEvent.dragStart(screen.getByText('tile').parentElement as Element, { dataTransfer })

    expect(dataTransfer.types).toContain('application/x-scenario-asset+mesh')
    // The marker that tells the drop it has a download to do first.
    expect(dataTransfer.types).toContain('application/x-scenario-asset+library')
  })

  // The one action the line is for, and the only one it can do: bring the bytes in.
  it('fetches the asset when the entry is chosen', async () => {
    let pulled: readonly string[] = []
    installFakeBridge({
      cloud: {
        pull: ids => {
          pulled = ids
          return Promise.resolve([{ assetId: 'asset_remote', ok: true }])
        },
      },
    })
    open()

    fireEvent.click(screen.getByRole('menuitem', { name: 'Récupérer dans le projet' }))

    await vi.waitFor(() => expect(pulled).toEqual(['asset_remote']))
  })
})
