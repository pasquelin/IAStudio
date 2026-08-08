import type { DockviewApi } from 'dockview-react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { DocumentDescriptor } from '@shared/domain/document'
import type { WorkspaceId } from '@shared/domain/workspace'
import { useDocuments } from '@/stores/documents'
import { useLayouts } from '@/stores/layouts'
import {
  closePanel,
  openDocument,
  openPanelIds,
  setDockviewApi,
  setDocumentTitle,
} from './dockview-api'

const scene: DocumentDescriptor = { id: 'doc-1', kind: 'scene', title: 'Niveau', workspace: '3d' }
const sequence: DocumentDescriptor = {
  id: 'doc-2',
  kind: 'sequence',
  title: 'Bande annonce',
  workspace: 'video',
}

type Panel = {
  id: string
  setTitle: ReturnType<typeof vi.fn>
  api: { setActive: ReturnType<typeof vi.fn>; close: ReturnType<typeof vi.fn> }
}

/**
 * A Dockview api that only holds panels. The real one needs a layout engine and a DOM box; what
 * this module does with it is add, find, retitle and close — nothing that needs a layout.
 */
function fakeApi() {
  const panels: Panel[] = []
  const addPanel = vi.fn((options: { id: string }): void => {
    panels.push({
      id: options.id,
      setTitle: vi.fn(),
      api: { setActive: vi.fn(), close: vi.fn() },
    })
  })

  const api = {
    panels,
    addPanel,
    getPanel: (id: string) => panels.find(panel => panel.id === id),
  }
  // The real type carries thirty members this module never touches.
  return { api: api as unknown as DockviewApi, addPanel, panels }
}

const mount = (workspace: WorkspaceId) => {
  const fake = fakeApi()
  setDockviewApi(workspace, fake.api)
  return fake
}

beforeEach(() => {
  vi.clearAllMocks()
  useDocuments.setState({ documents: {}, stored: [], activeId: null })
  useLayouts.setState({ activeWorkspace: '3d', layouts: {} })
})

describe('opening a document', () => {
  it('adds a panel for a document of the workspace on screen', () => {
    const { addPanel } = mount('3d')

    openDocument(scene)

    expect(addPanel).toHaveBeenCalledWith({
      id: 'doc-1',
      component: 'scene',
      title: 'Niveau',
      params: { documentId: 'doc-1' },
    })
  })

  // A panel whose document the window has never heard of renders "no longer open".
  it('takes the descriptor in before the panel exists', () => {
    mount('3d')

    openDocument(scene)
    expect(useDocuments.getState().documents['doc-1']).toBe(scene)
  })

  // Dockview refuses a second panel under an id it already holds.
  it('brings an already-open document forward rather than opening it twice', () => {
    const { addPanel, panels } = mount('3d')
    openDocument(scene)

    openDocument(scene)

    expect(addPanel).toHaveBeenCalledTimes(1)
    expect(panels[0]?.api.setActive).toHaveBeenCalled()
  })
})

/**
 * Dockview is keyed on the workspace, so switching one throws its api away and builds another a
 * React commit later. A panel added to the outgoing api lands in a layout about to be discarded
 * — a document that silently never opens.
 */
describe('opening a document of another workspace', () => {
  it('switches to the workspace that owns it', () => {
    mount('3d')

    openDocument(sequence)
    expect(useLayouts.getState().activeWorkspace).toBe('video')
  })

  it('adds nothing to the api being left behind', () => {
    const leaving = mount('3d')

    openDocument(sequence)
    expect(leaving.addPanel).not.toHaveBeenCalled()
  })

  it('opens it once the workspace that owns it has mounted', () => {
    mount('3d')
    openDocument(sequence)

    const arriving = mount('video')

    expect(arriving.addPanel).toHaveBeenCalledWith(expect.objectContaining({ id: 'doc-2' }))
  })

  it('opens it once and not again on the next remount', () => {
    mount('3d')
    openDocument(sequence)
    mount('video')

    const remounted = mount('video')

    expect(remounted.addPanel).not.toHaveBeenCalled()
  })

  // Waiting for Video must not open in Image on the way past.
  it('leaves a document waiting for a workspace nobody has gone to yet', () => {
    mount('3d')
    openDocument(sequence)

    const passing = mount('image')
    expect(passing.addPanel).not.toHaveBeenCalled()

    const arriving = mount('video')
    expect(arriving.addPanel).toHaveBeenCalledWith(expect.objectContaining({ id: 'doc-2' }))
  })
})

describe('the panels of the workspace on screen', () => {
  it('names them in the order they are shown', () => {
    mount('3d')
    openDocument(scene)
    openDocument({ ...scene, id: 'doc-3', title: 'Autre' })

    expect(openPanelIds()).toEqual(['doc-1', 'doc-3'])
  })

  // Remounting is how a workspace switch happens: the panels of the one being left are gone.
  it('answers nothing for a workspace that holds no panel', () => {
    mount('3d')
    openDocument(scene)

    mount('image')
    expect(openPanelIds()).toEqual([])
  })
})

describe('the tab of a document', () => {
  it('carries a bullet while the work is not on disk', () => {
    const { panels } = mount('3d')
    openDocument(scene)

    setDocumentTitle('doc-1', 'Niveau', true)
    expect(panels[0]?.setTitle).toHaveBeenCalledWith('Niveau •')

    setDocumentTitle('doc-1', 'Niveau', false)
    expect(panels[0]?.setTitle).toHaveBeenCalledWith('Niveau')
  })

  it('says nothing about a document no panel holds', () => {
    mount('3d')
    expect(() => setDocumentTitle('gone', 'Niveau', true)).not.toThrow()
    expect(() => closePanel('gone')).not.toThrow()
  })

  it('closes the panel it names', () => {
    const { panels } = mount('3d')
    openDocument(scene)

    closePanel('doc-1')
    expect(panels[0]?.api.close).toHaveBeenCalled()
  })
})
