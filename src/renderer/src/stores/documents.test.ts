import { beforeEach, describe, expect, it } from 'vitest'
import { documentsIn, pruneDocuments, useDocuments } from './documents'

describe('documents store', () => {
  beforeEach(() => {
    localStorage.clear()
    useDocuments.setState({ documents: {} })
  })

  it('survives a reload, because the layout that reopens the tabs does', () => {
    const created = useDocuments.getState().create('3d')
    if (!created) throw new Error('expected a document')

    // `stores/layouts.ts` persists the Dockview layout, so a reload brings the tab back.
    // A descriptor left in memory made that tab come back empty.
    const stored: unknown = JSON.parse(localStorage.getItem('scenario-studio:documents') ?? 'null')
    expect(JSON.stringify(stored)).toContain(created.id)
  })

  it('keeps a document some layout still shows', () => {
    const kept = useDocuments.getState().create('3d')
    if (!kept) throw new Error('expected a document')

    pruneDocuments({ '3d': { panels: { [kept.id]: {} } } })
    expect(useDocuments.getState().documents[kept.id]).toBeDefined()
  })

  it('drops a document no layout shows any more', () => {
    // Closing a tab rewrites its workspace layout without the panel; the descriptor would
    // otherwise stay in storage for good, since it is now persisted.
    const dropped = useDocuments.getState().create('3d')
    if (!dropped) throw new Error('expected a document')

    pruneDocuments({ '3d': { panels: {} } })
    expect(useDocuments.getState().documents[dropped.id]).toBeUndefined()
  })

  it('survives a layout that has no panels recorded at all', () => {
    useDocuments.getState().create('3d')
    expect(() => pruneDocuments({ image: undefined })).not.toThrow()
  })

  it('creates a scene document in the 3d workspace', () => {
    const created = useDocuments.getState().create('3d')
    expect(created?.kind).toBe('scene')
    expect(created?.workspace).toBe('3d')
  })

  it('creates nothing in a workspace without an editor', () => {
    expect(useDocuments.getState().create('audio')).toBeNull()
    expect(Object.keys(useDocuments.getState().documents)).toHaveLength(0)
  })

  it('numbers untitled documents per workspace', () => {
    const { create } = useDocuments.getState()
    const first = create('3d')
    const second = create('3d')
    const other = create('image')

    expect(first?.title).not.toBe(second?.title)
    // Numbering restarts per workspace: an image document is not "Untitled 3" because the
    // 3D workspace already holds two.
    expect(other?.title).toBe(first?.title)
  })

  it('gives every document its own id', () => {
    const { create } = useDocuments.getState()
    expect(create('3d')?.id).not.toBe(create('3d')?.id)
  })

  it('forgets a closed document', () => {
    const created = useDocuments.getState().create('3d')
    if (!created) throw new Error('expected a document')
    useDocuments.getState().close(created.id)
    expect(useDocuments.getState().documents[created.id]).toBeUndefined()
  })

  it('lists only the documents of the asked workspace', () => {
    const { create } = useDocuments.getState()
    create('3d')
    create('image')
    expect(documentsIn(useDocuments.getState(), '3d')).toHaveLength(1)
  })
})
