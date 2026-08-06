import { render } from '@testing-library/react'
import { Orientation } from 'dockview-react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { useDocuments } from '@/stores/documents'
import { useLayouts, type SerializedLayout } from '@/stores/layouts'

const addPanel = vi.fn()
const toJSON = vi.fn()
const fromJSON = vi.fn()
const onDidLayoutChange = vi.fn(() => ({ dispose: vi.fn() }))

// Dockview needs a real layout engine and a DOM box to lay panels out; the shell only cares
// that it hands the API over, restores, and remembers. `Orientation` is re-exposed because the
// mock replaces the whole module, and a serialized layout cannot be built without it.
vi.mock('dockview-react', () => ({
  Orientation: { HORIZONTAL: 'HORIZONTAL', VERTICAL: 'VERTICAL' },
  DockviewReact: (props: { onReady: (event: { api: unknown }) => void }) => {
    props.onReady({ api: { addPanel, toJSON, fromJSON, onDidLayoutChange } })
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
    useDocuments.setState({ documents: {} })
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

  it('opens a panel for a document created after mount', async () => {
    const { DocumentArea, openDocument } = await import('./DocumentArea')
    render(<DocumentArea />)

    const created = useDocuments.getState().create('3d')
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
})
