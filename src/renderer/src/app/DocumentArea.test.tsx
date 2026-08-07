import { render } from '@testing-library/react'
import { Orientation } from 'dockview-react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { useDocuments } from '@/stores/documents'
import { useLayouts, type SerializedLayout } from '@/stores/layouts'

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

function layout(): SerializedLayout {
  return {
    grid: {
      root: { type: 'branch', data: [] },
      height: 100,
      width: 100,
      orientation: Orientation.HORIZONTAL,
    },
    panels: {},
  }
}

describe('DocumentArea', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    panels = {}
    useDocuments.setState({ documents: {}, activeId: null })
    useLayouts.setState({ activeWorkspace: '3d', layouts: {} })
  })

  it('restores the layout stored for the active workspace', async () => {
    const stored = layout()
    useLayouts.setState({ layouts: { '3d': stored } })

    const { DocumentArea } = await import('./DocumentArea')
    render(<DocumentArea />)

    expect(fromJSON).toHaveBeenCalledWith(stored)
  })

  it('does not restore another workspace layout', async () => {
    useLayouts.setState({ layouts: { image: layout() } })

    const { DocumentArea } = await import('./DocumentArea')
    render(<DocumentArea />)

    expect(fromJSON).not.toHaveBeenCalled()
  })

  it('tells the store which document is in front, for the tool windows outside it', async () => {
    const { DocumentArea } = await import('./DocumentArea')
    render(<DocumentArea />)

    // Panels sit in Dockview; a layer stack on the edge does not, and has no other way to know.
    announceActivePanel?.({ panel: { id: 'doc-7' } })
    expect(useDocuments.getState().activeId).toBe('doc-7')

    announceActivePanel?.({})
    expect(useDocuments.getState().activeId).toBeNull()
  })

  it('opens a panel for a document created after mount', async () => {
    const { DocumentArea, openDocument } = await import('./DocumentArea')
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
    const { DocumentArea, setDocumentTitle } = await import('./DocumentArea')
    render(<DocumentArea />)
    panels['doc-3'] = { setTitle }

    setDocumentTitle('doc-3', 'Set dressing', true)
    expect(setTitle).toHaveBeenCalledWith('Set dressing •')

    setDocumentTitle('doc-3', 'Set dressing', false)
    expect(setTitle).toHaveBeenLastCalledWith('Set dressing')
  })
})
