import type { DocumentDescriptor } from '@shared/domain/document'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { useDocuments } from '@/stores/documents'
import { showPanels } from '@/stores/layout-fixtures'
import { useLayouts } from '@/stores/layouts'
import { closeOrphanTabs } from './orphan-tabs'

const closePanel = vi.hoisted(() => vi.fn())
vi.mock('./dockview-api', () => ({ closePanel }))

const SAVED: DocumentDescriptor = {
  id: 'saved',
  kind: 'image',
  workspace: 'image',
  title: 'On disk',
}
const FRESH: DocumentDescriptor = {
  id: 'fresh',
  kind: 'image',
  workspace: 'image',
  title: 'Untitled 1',
}

function panelsLeft(): string[] {
  return Object.keys(useLayouts.getState().layouts.image?.panels ?? {})
}

describe('closeOrphanTabs', () => {
  beforeEach(() => {
    closePanel.mockClear()
    useLayouts.setState({ layouts: {} })
    useDocuments.setState({ documents: {}, stored: [], activeId: null })
  })

  // The reported defect: two documents created and never saved, then a reload. The folder holds
  // neither, the layout holds both, and each tab comes back saying it is not open.
  it('closes a restored tab whose document is in no folder and no store', () => {
    showPanels('image', 'ghost')

    closeOrphanTabs()

    expect(closePanel).toHaveBeenCalledWith('ghost')
    expect(useLayouts.getState().layouts.image).toBeUndefined()
  })

  it('leaves the tab of a document the folder holds', () => {
    showPanels('image', SAVED.id)
    useDocuments.setState({ documents: { [SAVED.id]: SAVED }, stored: [SAVED] })

    closeOrphanTabs()

    expect(closePanel).not.toHaveBeenCalled()
    expect(panelsLeft()).toEqual([SAVED.id])
  })

  // A document created during the session is absent from the folder too — `create` writes
  // nothing on purpose — and sweeping on that alone would close a tab under the hands.
  it('leaves the tab of a document created during the session', () => {
    showPanels('image', FRESH.id)
    useDocuments.setState({ documents: { [FRESH.id]: FRESH }, stored: [] })

    closeOrphanTabs()

    expect(closePanel).not.toHaveBeenCalled()
    expect(panelsLeft()).toEqual([FRESH.id])
  })

  // An Explorer row opened while the listing travelled is adopted into the store and nowhere
  // else: the store is read when the answer is settled, not passed in from before it.
  it('leaves the tab of a document adopted from a listing', () => {
    showPanels('image', SAVED.id)
    useDocuments.setState({ documents: {}, stored: [SAVED] })

    closeOrphanTabs()

    expect(closePanel).not.toHaveBeenCalled()
  })

  it('keeps the tabs of the same layout that have a document', () => {
    showPanels('image', SAVED.id, 'ghost')
    useDocuments.setState({ documents: { [SAVED.id]: SAVED }, stored: [SAVED] })

    closeOrphanTabs()

    expect(panelsLeft()).toEqual([SAVED.id])
  })

  // Dockview is mounted for one workspace at a time, so the tabs of the others are in the
  // stored layout and nowhere a `close` could reach them.
  it('takes a ghost out of a workspace Dockview has not mounted', () => {
    useLayouts.setState({ layouts: {} })
    showPanels('3d', 'ghost')

    closeOrphanTabs()

    expect(useLayouts.getState().layouts['3d']).toBeUndefined()
  })

  it('touches nothing when every tab has its document', () => {
    showPanels('image', SAVED.id)
    useDocuments.setState({ documents: { [SAVED.id]: SAVED }, stored: [SAVED] })
    const before = useLayouts.getState().layouts

    closeOrphanTabs()

    expect(useLayouts.getState().layouts).toBe(before)
  })
})
