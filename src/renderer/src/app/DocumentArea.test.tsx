import { fireEvent, render, screen } from '@testing-library/react'
import type { Asset } from '@shared/domain/asset'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { forgetReportedFailures } from '@/services/diagnostics'
import { bridgeWatchingLogs } from '@/services/fake-bridge'
import { useDocuments } from '@/stores/documents'
import { layoutShowing } from '@/stores/layout-fixtures'
import { useAssets } from '@/stores/assets'
import { useLayouts } from '@/stores/layouts'
import { startAssetDrag } from '@/helpers/asset-drag'
import { dragTransfer } from '@/helpers/drag-fixtures'
import { DocumentArea } from './DocumentArea'
import { openDocument, setDocumentTitle } from './dockview-api'

const addPanel = vi.fn()
const setTitle = vi.fn()
/** Panels Dockview is pretending to hold, so the tab marker has something to write on. */
let panels: Record<string, { setTitle: (title: string) => void }> = {}
const getPanel = vi.fn((id: string) => panels[id])
const toJSON = vi.fn()
const fromJSON = vi.fn()
const onDidLayoutChange = vi.fn(() => ({ dispose: vi.fn() }))
let announceActivePanel: ((change: { panel?: { id: string } }) => void) | null = null
const onDidActivePanelChange = vi.fn((listener: (change: { panel?: { id: string } }) => void) => {
  announceActivePanel = listener
  return { dispose: vi.fn() }
})

// Dockview needs a real layout engine and a DOM box to lay panels out; the shell only cares
// that it hands the API over, restores, and remembers. `Orientation` is re-exposed because the
// mock replaces the whole module, and a serialized layout cannot be built without it.
vi.mock('dockview-react', () => ({
  Orientation: { HORIZONTAL: 'HORIZONTAL', VERTICAL: 'VERTICAL' },
  DockviewReact: (props: { onReady: (event: { api: unknown }) => void }) => {
    props.onReady({
      api: { addPanel, getPanel, toJSON, fromJSON, onDidLayoutChange, onDidActivePanelChange },
    })
    return <div data-testid="dockview" />
  },
}))

describe('DocumentArea', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    panels = {}
    forgetReportedFailures()
    useDocuments.setState({ documents: {}, activeId: null })
    useLayouts.setState({ activeWorkspace: '3d', layouts: {} })
  })

  it('restores the layout stored for the active workspace', async () => {
    const stored = layoutShowing()
    useLayouts.setState({ layouts: { '3d': stored } })

    render(<DocumentArea />)

    expect(fromJSON).toHaveBeenCalledWith(stored)
  })

  it('does not restore another workspace layout', async () => {
    useLayouts.setState({ layouts: { image: layoutShowing() } })

    render(<DocumentArea />)

    expect(fromJSON).not.toHaveBeenCalled()
  })

  describe('given a stored layout Dockview refuses', () => {
    beforeEach(() => {
      useLayouts.setState({ layouts: { '3d': layoutShowing() } })
      fromJSON.mockImplementation(() => {
        throw new Error('dockview: root must be of type branch')
      })
    })

    // `clearAllMocks` above resets calls, not implementations: without this the throwing
    // `fromJSON` would follow the tests declared after this block.
    afterEach(() => {
      fromJSON.mockReset()
    })

    // Installed here rather than in the hook: `vi.stubGlobal` outlives the block, and the tests
    // declared after it are meant to run with no bridge at all.
    it('records it in the log rather than dropping the arrangement in silence', () => {
      const log = bridgeWatchingLogs()

      render(<DocumentArea />)

      expect(log.report).toHaveBeenCalledWith({
        level: 'error',
        scope: 'shell.layout',
        message: '3d: dockview: root must be of type branch',
      })
    })

    it('forgets the layout, so the next launch is not the same launch', () => {
      render(<DocumentArea />)

      expect(useLayouts.getState().layouts['3d']).toBeUndefined()
    })

    it('still subscribes, so the workspace remembers what the user arranges next', () => {
      render(<DocumentArea />)

      expect(onDidLayoutChange).toHaveBeenCalled()
      expect(onDidActivePanelChange).toHaveBeenCalled()
    })
  })

  it('tells the store which document is in front, for the tool windows outside it', async () => {
    render(<DocumentArea />)

    // Panels sit in Dockview; a layer stack on the edge does not, and has no other way to know.
    announceActivePanel?.({ panel: { id: 'doc-7' } })
    expect(useDocuments.getState().activeId).toBe('doc-7')

    announceActivePanel?.({})
    expect(useDocuments.getState().activeId).toBeNull()
  })

  it('opens a panel for a document created after mount', async () => {
    render(<DocumentArea />)

    const created = await useDocuments.getState().create('3d')
    if (!created) throw new Error('expected a document')
    openDocument(created)

    expect(addPanel).toHaveBeenCalledWith(
      expect.objectContaining({
        id: created.id,
        component: 'scene',
        params: { documentId: created.id },
      }),
    )
  })

  it('marks the tab of a document with unsaved work, and only that tab', async () => {
    render(<DocumentArea />)
    panels['doc-3'] = { setTitle }

    setDocumentTitle('doc-3', 'Set dressing', true)
    expect(setTitle).toHaveBeenCalledWith('Set dressing •')

    setDocumentTitle('doc-3', 'Set dressing', false)
    expect(setTitle).toHaveBeenLastCalledWith('Set dressing')
  })
})

describe('the last surface a dropped asset reaches', () => {
  const picture: Asset = {
    id: 'asset_1',
    name: 'moss.png',
    type: 'image',
    location: 'local',
    tags: [],
    createdAt: '2026-08-07T10:00:00.000Z',
  }

  beforeEach(() => {
    useAssets.setState({ items: [picture] })
    useDocuments.setState({ documents: {}, activeId: null })
  })

  /**
   * Everything else in the studio answers a different question with a drop — which channel,
   * which track, where on the graph. This one answers the fallback: what no surface took gets
   * opened, which is what an editor does with a file dropped on it.
   */
  it('opens what no other surface took', async () => {
    const openAsset = vi.fn()
    vi.doMock('@/helpers/open-asset', () => ({ openAsset }))

    render(<DocumentArea />)
    const dataTransfer = dragTransfer()
    startAssetDrag({ dataTransfer }, { id: 'asset_1', type: 'image' })

    fireEvent.drop(screen.getByTestId('dockview').parentElement as Element, { dataTransfer })

    await vi.waitFor(() => expect(openAsset).toHaveBeenCalledWith(picture))
    vi.doUnmock('@/helpers/open-asset')
  })

  // A frame here would outline the whole middle of the window, which says nothing the user
  // cannot already see. The pointer's own "+" carries the answer instead.
  it('draws no frame while an asset flies over it', () => {
    render(<DocumentArea />)
    const surface = screen.getByTestId('dockview').parentElement as Element
    const dataTransfer = dragTransfer()
    startAssetDrag({ dataTransfer }, { id: 'asset_1', type: 'image' })

    fireEvent.dragOver(surface, { dataTransfer })

    expect(surface.className).not.toContain('outline-')
  })

  // Dropping adds; it takes nothing away from the shelf. `move` would show the arrow that says
  // otherwise, which is what the platform draws from this.
  it('offers the pointer that means "add"', () => {
    render(<DocumentArea />)
    const dataTransfer = dragTransfer()
    startAssetDrag({ dataTransfer }, { id: 'asset_1', type: 'image' })

    fireEvent.dragOver(screen.getByTestId('dockview').parentElement as Element, { dataTransfer })

    expect(dataTransfer.dropEffect).toBe('copy')
  })
})
