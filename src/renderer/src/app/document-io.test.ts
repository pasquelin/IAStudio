import { beforeEach, describe, expect, it, vi } from 'vitest'
import { DOCUMENT_VERSION } from '@shared/domain/document'
import type {
  DocumentDescriptor,
  DocumentDraft,
  DocumentFile,
  DocumentKind,
} from '@shared/domain/document'
import { addNode } from '@/engines/scene/commands'
import { meshNode } from '@/engines/scene/scene-fixtures'
import { installFakeBridge } from '@/services/fake-bridge'
import { useDocuments } from '@/stores/documents'
import { clearScenes } from '@/stores/scene-fixtures'
import { isDirty, sceneOf, useScenes } from '@/stores/scenes'
import { restoreDocument, saveDocument } from './document-io'

const box = meshNode('box-1')

const savedFile = (): DocumentFile => ({
  version: DOCUMENT_VERSION,
  kind: 'scene',
  title: 'Set dressing',
  // Serialized, as it crosses the boundary: the file layer never parses a content.
  content: JSON.stringify({ nodes: [box] }),
  updatedAt: '2026-08-07T10:00:00.000Z',
})

function scene(id: string): DocumentDescriptor {
  return { id, kind: 'scene', title: 'Set dressing', workspace: '3d' }
}

beforeEach(() => {
  vi.clearAllMocks()
  localStorage.clear()
  clearScenes()
  useDocuments.setState({ documents: {}, activeId: null })
})

describe('saveDocument', () => {
  const openScene = async (): Promise<string> => {
    const created = await useDocuments.getState().create('3d')
    if (!created) throw new Error('expected a document')
    useScenes.getState().runCommand(created.id, addNode(box))
    return created.id
  }

  it('writes the scene, and only what a scene is — never its selection', async () => {
    const write = vi.fn(() => Promise.resolve())
    installFakeBridge({ documents: { write } })

    const documentId = await openScene()
    await saveDocument(documentId)

    expect(write).toHaveBeenCalledWith(documentId, 'scene', {
      title: expect.any(String),
      content: JSON.stringify({ nodes: [box], environment: { kind: 'studio' } }),
    })
  })

  it('marks the document clean once it is written', async () => {
    installFakeBridge({ documents: { write: () => Promise.resolve() } })

    const documentId = await openScene()
    expect(isDirty(useScenes.getState(), documentId)).toBe(true)

    await saveDocument(documentId)
    expect(isDirty(useScenes.getState(), documentId)).toBe(false)
  })

  // The marker is the only place the studio can say a document is not on disk; a failed write
  // that cleared it would claim the opposite.
  it('leaves the document modified when the write fails', async () => {
    installFakeBridge({ documents: { write: () => Promise.reject(new Error('no project')) } })

    const documentId = await openScene()
    await expect(saveDocument(documentId)).rejects.toThrow()
    expect(isDirty(useScenes.getState(), documentId)).toBe(true)
  })

  // The content is read before the write; counting the edit as saved would lose it silently.
  it('does not count an edit made while the file was being written', async () => {
    let release = (): void => {}
    installFakeBridge({
      documents: {
        write: () =>
          new Promise<void>(resolve => {
            release = resolve
          }),
      },
    })

    const documentId = await openScene()
    const writing = saveDocument(documentId)

    useScenes.getState().runCommand(documentId, addNode(meshNode('box-2')))
    release()
    await writing

    expect(isDirty(useScenes.getState(), documentId)).toBe(true)
  })

  // The file on disk is the only copy. A read that failed leaves the tab empty and modified, and
  // the bullet invites a ⌘S — which would write `{ nodes: [] }` over the scene it could not read.
  it('refuses to write a document whose state never loaded', async () => {
    const write = vi.fn(() => Promise.resolve())
    installFakeBridge({ documents: { write, read: () => Promise.reject(new Error('gone')) } })
    useDocuments.setState({ documents: { 'doc-1': scene('doc-1') } })

    await restoreDocument('doc-1')
    await saveDocument('doc-1')

    expect(write).not.toHaveBeenCalled()
  })

  // The empty viewport a failed read leaves is indistinguishable from a new document: the user
  // draws in it, the state exists, and the guard on `holds` alone would let ⌘S overwrite the
  // scene nothing could read.
  it('keeps refusing to write once the user has drawn in a document that would not load', async () => {
    const write = vi.fn(() => Promise.resolve())
    installFakeBridge({ documents: { write, read: () => Promise.reject(new Error('gone')) } })
    useDocuments.setState({ documents: { 'doc-1': scene('doc-1') } })

    await restoreDocument('doc-1')
    useScenes.getState().runCommand('doc-1', addNode(box))
    await saveDocument('doc-1')

    expect(write).not.toHaveBeenCalled()
  })

  it('writes nothing for a space that has no serialized form yet', async () => {
    const write = vi.fn(() => Promise.resolve())
    installFakeBridge({ documents: { write } })

    const created = await useDocuments.getState().create('image')
    if (!created) throw new Error('expected a document')
    await saveDocument(created.id)

    expect(write).not.toHaveBeenCalled()
  })
})

describe('restoreDocument', () => {
  it('reads a saved document back from the project', async () => {
    installFakeBridge({ documents: { read: () => Promise.resolve(savedFile()) } })
    useDocuments.setState({ documents: { 'doc-1': scene('doc-1') } })

    await restoreDocument('doc-1')

    expect(sceneOf(useScenes.getState(), 'doc-1').nodes).toEqual([box])
    expect(isDirty(useScenes.getState(), 'doc-1')).toBe(false)
  })

  // `null` is what a document that was never saved reads as — not a failure, and not a reason
  // to leave the viewport black.
  it('lights a document the project holds no file for', async () => {
    installFakeBridge({ documents: { read: () => Promise.resolve(null) } })
    useDocuments.setState({ documents: { 'doc-1': scene('doc-1') } })

    await restoreDocument('doc-1')
    expect(sceneOf(useScenes.getState(), 'doc-1').nodes).toHaveLength(3)
  })

  it('asks for the document by its own id and kind', async () => {
    const read = vi.fn(() => Promise.resolve(savedFile()))
    installFakeBridge({ documents: { read } })
    useDocuments.setState({ documents: { 'doc-1': scene('doc-1') } })

    await restoreDocument('doc-1')
    expect(read).toHaveBeenCalledWith('doc-1', 'scene')
  })

  it('leaves a tab that already holds a scene alone', async () => {
    const read = vi.fn(() => Promise.resolve(savedFile()))
    installFakeBridge({ documents: { read } })
    useDocuments.setState({ documents: { 'doc-1': scene('doc-1') } })
    useScenes.getState().runCommand('doc-1', addNode(box))

    await restoreDocument('doc-1')
    expect(read).not.toHaveBeenCalled()
  })

  // A default scene put up in its place is a scene a later ⌘S would write over the file.
  it('does not stand a default scene in for a file that will not read', async () => {
    installFakeBridge({ documents: { read: () => Promise.reject(new Error('gone')) } })
    useDocuments.setState({ documents: { 'doc-1': scene('doc-1') } })

    await restoreDocument('doc-1')
    expect(useScenes.getState().states['doc-1']).toBeUndefined()
    expect(isDirty(useScenes.getState(), 'doc-1')).toBe(true)
  })

  // The tab is live while the read is in flight, and the Add menu acts on it. Overwriting that
  // edit would also mark the document clean, leaving an undo stack describing a scene that never
  // existed.
  it('keeps an edit made while the read was in flight', async () => {
    let deliver = (): void => {}
    installFakeBridge({
      documents: {
        read: () =>
          new Promise<DocumentFile>(resolve => {
            deliver = () => resolve(savedFile())
          }),
      },
    })
    useDocuments.setState({ documents: { 'doc-1': scene('doc-1') } })

    const reading = restoreDocument('doc-1')
    useScenes.getState().runCommand('doc-1', addNode(meshNode('box-2')))
    deliver()
    await reading

    expect(sceneOf(useScenes.getState(), 'doc-1').nodes.map(node => node.id)).toEqual(['box-2'])
    expect(isDirty(useScenes.getState(), 'doc-1')).toBe(true)
  })

  // React's StrictMode runs every mount effect twice, and switching workspace remounts the
  // panel: without this, one open is two reads of the same file.
  it('reads once for a panel that mounts twice', async () => {
    const read = vi.fn(() => Promise.resolve(savedFile()))
    installFakeBridge({ documents: { read } })
    useDocuments.setState({ documents: { 'doc-1': scene('doc-1') } })

    await Promise.all([restoreDocument('doc-1'), restoreDocument('doc-1')])
    expect(read).toHaveBeenCalledTimes(1)
  })

  it('fills nothing for a kind whose space cannot be restored yet', async () => {
    const read = vi.fn(() => Promise.resolve(savedFile()))
    installFakeBridge({ documents: { read } })
    useDocuments.setState({
      documents: { 'doc-1': { id: 'doc-1', kind: 'image', title: 'Poster', workspace: 'image' } },
    })

    await restoreDocument('doc-1')
    expect(read).not.toHaveBeenCalled()
  })
})

// A draft is what the file layer stamps its envelope onto; the renderer supplies neither the
// version nor the timestamp, and this is the shape that has to keep matching.
describe('what reaches the bridge', () => {
  it('hands over a draft, not a file', async () => {
    let draft: DocumentDraft | null = null
    installFakeBridge({
      documents: {
        write: (_id: string, _kind: DocumentKind, given: DocumentDraft) => {
          draft = given
          return Promise.resolve()
        },
      },
    })

    const created = await useDocuments.getState().create('3d')
    if (!created) throw new Error('expected a document')
    useScenes.getState().runCommand(created.id, addNode(box))
    await saveDocument(created.id)

    expect(Object.keys(draft ?? {}).sort()).toEqual(['content', 'title'])
  })
})
