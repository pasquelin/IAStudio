import { beforeEach, describe, expect, it, vi } from 'vitest'
import { DOCUMENT_KINDS, DOCUMENT_VERSION, workspaceForKind } from '@shared/domain/document'
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
import { isPartName } from '@shared/domain/document'
import { DEFAULT_CANVAS } from '@/engines/canvas/canvas-state'
import { holdCanvas } from '@/spaces/image/canvas-hosts'
import { useCanvases } from '@/stores/canvases'
import { pushEdit } from '@/engines/audio/edits'
import { addClip } from '@/engines/timeline/commands'
import { makeClip } from '@/engines/timeline/timeline-state'
import { setSunAngles } from '@/engines/skybox/commands'
import { useAudioEdits } from '@/stores/audio-edits'
import { sequenceStore, useSequences } from '@/stores/sequences'
import { useSkyboxes } from '@/stores/skyboxes'
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
    let started = (): void => {}
    const writeStarted = new Promise<void>(resolve => {
      started = resolve
    })
    installFakeBridge({
      documents: {
        write: () => {
          started()
          return new Promise<void>(resolve => {
            release = resolve
          })
        },
      },
    })

    const documentId = await openScene()
    const writing = saveDocument(documentId)
    // `capture` is asynchronous — an image extracts its pixels off the GPU before the write — so
    // the write is booked a microtask later than the call, not within it.
    await writeStarted

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

  // A kind absent from the table has a Save that does nothing and a tab that never reads its
  // file — silently. This is what says the table still covers everything the studio can create.
  it('reads the file of every kind the studio can create', async () => {
    const read = vi.fn(() => Promise.resolve(null))
    installFakeBridge({ documents: { read } })

    for (const kind of DOCUMENT_KINDS) {
      const workspace = workspaceForKind(kind)
      if (!workspace) throw new Error(`no workspace opens ${kind}`)
      const id = `doc-${kind}`
      useDocuments.setState({ documents: { [id]: { id, kind, title: kind, workspace } } })
      await restoreDocument(id)
    }

    expect(read).toHaveBeenCalledTimes(DOCUMENT_KINDS.length)
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

/**
 * The image is the one kind a string cannot hold: its pixels live in GPU textures, so the stack
 * goes in the manifest and each layer's picture in a file beside it. What is checked here is the
 * seam — that the engine holding the document is asked, and that what came back reaches it again.
 */
describe('an image document', () => {
  const PIXELS = 'iVBORw0KGgo='

  const openImage = async (): Promise<string> => {
    const created = await useDocuments.getState().create('image')
    if (!created) throw new Error('expected a document')
    useCanvases.getState().ensure(created.id, () => DEFAULT_CANVAS)
    return created.id
  }

  it('writes one file per surface, named after the layer it belongs to', async () => {
    const write = vi.fn(() => Promise.resolve())
    installFakeBridge({ documents: { write } })
    const documentId = await openImage()
    const release = holdCanvas(documentId, () => ({
      pixelSnapshots: () =>
        Promise.resolve([
          { layerId: 'layer-1', mask: false, data: PIXELS },
          { layerId: 'layer-1', mask: true, data: PIXELS },
        ]),
      restoreSnapshot: () => Promise.resolve(),
    }))

    await saveDocument(documentId)
    release()

    expect(write).toHaveBeenCalledWith(
      documentId,
      'image',
      expect.objectContaining({
        parts: [
          { name: 'p_layer-1.png', data: PIXELS },
          { name: 'm_layer-1.png', data: PIXELS },
        ],
      }),
    )
  })

  // Every part name becomes a path in the main process, so the two ends have to agree.
  it('names its parts so the file layer accepts them', async () => {
    const written: DocumentDraft[] = []
    installFakeBridge({
      documents: {
        write: (_id, _kind, draft) => {
          written.push(draft)
          return Promise.resolve()
        },
      },
    })
    const documentId = await openImage()
    const release = holdCanvas(documentId, () => ({
      pixelSnapshots: () => Promise.resolve([{ layerId: 'a-b_1', mask: true, data: PIXELS }]),
      restoreSnapshot: () => Promise.resolve(),
    }))

    await saveDocument(documentId)
    release()

    expect(written[0]?.parts).toHaveLength(1)
    for (const part of written[0]?.parts ?? []) expect(isPartName(part.name)).toBe(true)
  })

  /**
   * A folder is replaced whole, so writing one with no pictures would delete the ones on disk and
   * mark the document clean — the work gone, with nothing said. The engine is unreachable while it
   * boots its GPU context, which is exactly when a ⌘S after switching workspace lands.
   */
  it('refuses to save rather than write a document without its pixels', async () => {
    const write = vi.fn(() => Promise.resolve())
    installFakeBridge({ documents: { write } })
    const documentId = await openImage()

    await expect(saveDocument(documentId)).rejects.toThrow(/pixels cannot be read/)
    expect(write).not.toHaveBeenCalled()
  })

  /**
   * A suffix would not be injective: a layer literally called `x-mask` and the mask of a layer
   * called `x` would claim the same file, and one would quietly overwrite the other.
   */
  it('tells a layer called like a mask apart from a mask', async () => {
    const written: DocumentDraft[] = []
    installFakeBridge({
      documents: {
        write: (_id, _kind, draft) => {
          written.push(draft)
          return Promise.resolve()
        },
      },
    })
    const documentId = await openImage()
    const release = holdCanvas(documentId, () => ({
      pixelSnapshots: () =>
        Promise.resolve([
          { layerId: 'x-mask', mask: false, data: PIXELS },
          { layerId: 'x', mask: true, data: PIXELS },
        ]),
      restoreSnapshot: () => Promise.resolve(),
    }))

    await saveDocument(documentId)
    release()

    expect(written[0]?.parts?.map(part => part.name)).toEqual(['p_x-mask.png', 'm_x.png'])
  })

  // One odd id costs that layer's pixels, never the whole document: `reviveLayer` takes whatever
  // a file holds, and the save must not fail on all of it.
  it('skips a layer whose id could not be a file name', async () => {
    const written: DocumentDraft[] = []
    installFakeBridge({
      documents: {
        write: (_id, _kind, draft) => {
          written.push(draft)
          return Promise.resolve()
        },
      },
    })
    const documentId = await openImage()
    const release = holdCanvas(documentId, () => ({
      pixelSnapshots: () =>
        Promise.resolve([
          { layerId: 'a b', mask: false, data: PIXELS },
          { layerId: 'fine', mask: false, data: PIXELS },
        ]),
      restoreSnapshot: () => Promise.resolve(),
    }))

    await saveDocument(documentId)
    release()

    expect(written[0]?.parts?.map(part => part.name)).toEqual(['p_fine.png'])
  })

  it('hands every saved picture back to the engine on the way in', async () => {
    const restoreSnapshot = vi.fn(() => Promise.resolve())
    installFakeBridge({
      documents: {
        read: () =>
          Promise.resolve({
            version: DOCUMENT_VERSION,
            kind: 'image' as DocumentKind,
            title: 'Poster',
            content: JSON.stringify(DEFAULT_CANVAS),
            updatedAt: '2026-08-08T10:00:00.000Z',
            parts: [{ name: 'm_layer-1.png', data: PIXELS }],
          }),
      },
    })
    const documentId = 'doc-img'
    useDocuments.setState({
      documents: {
        [documentId]: { id: documentId, kind: 'image', workspace: 'image', title: 'Poster' },
      },
      activeId: documentId,
    })
    const release = holdCanvas(documentId, () => ({
      pixelSnapshots: () => Promise.resolve([]),
      restoreSnapshot,
    }))

    await restoreDocument(documentId)
    release()

    expect(restoreSnapshot).toHaveBeenCalledWith({
      layerId: 'layer-1',
      mask: true,
      data: PIXELS,
    })
  })

  // A folder is the user's to open: a file they dropped in there is not a layer of theirs.
  it('ignores a file in the folder that names no layer', async () => {
    const restoreSnapshot = vi.fn(() => Promise.resolve())
    installFakeBridge({
      documents: {
        read: () =>
          Promise.resolve({
            version: DOCUMENT_VERSION,
            kind: 'image' as DocumentKind,
            title: 'Poster',
            content: JSON.stringify(DEFAULT_CANVAS),
            updatedAt: '2026-08-08T10:00:00.000Z',
            parts: [{ name: 'notes.txt', data: PIXELS }],
          }),
      },
    })
    const documentId = 'doc-img-2'
    useDocuments.setState({
      documents: {
        [documentId]: { id: documentId, kind: 'image', workspace: 'image', title: 'Poster' },
      },
      activeId: documentId,
    })
    const release = holdCanvas(documentId, () => ({
      pixelSnapshots: () => Promise.resolve([]),
      restoreSnapshot,
    }))

    await restoreDocument(documentId)
    release()

    expect(restoreSnapshot).not.toHaveBeenCalled()
  })
})

/**
 * The three kinds that could not reach the disk before. What is checked is the whole round
 * trip rather than either half: a serializer and a reader that agree only with themselves
 * would pass two separate tests and still lose the document.
 */
describe('the kinds a string holds', () => {
  /** Writes to memory and reads back, which is what a project folder does. */
  const diskBackedBridge = (kind: DocumentKind) => {
    const written = new Map<string, string>()
    installFakeBridge({
      documents: {
        write: (id: string, _kind: DocumentKind, draft: DocumentDraft) => {
          written.set(id, draft.content)
          return Promise.resolve()
        },
        read: (id: string) => {
          const content = written.get(id)
          return Promise.resolve<DocumentFile | null>(
            content === undefined
              ? null
              : {
                  version: DOCUMENT_VERSION,
                  kind,
                  title: 'Untitled',
                  content,
                  updatedAt: '2026-08-08T10:00:00.000Z',
                },
          )
        },
      },
    })
    return written
  }

  const open = async (workspace: 'video' | 'audio' | 'skyboxes'): Promise<string> => {
    const created = await useDocuments.getState().create(workspace)
    if (!created) throw new Error('expected a document')
    await restoreDocument(created.id)
    return created.id
  }

  it('carries a sequence to disk and back', async () => {
    diskBackedBridge('sequence')
    const documentId = await open('video')

    const clip = makeClip({ id: 'clip-1', assetId: 'asset-a', start: 0, duration: 2_000_000 })
    useSequences.getState().runCommand(documentId, addClip('V1', clip))
    const before = useSequences.getState().states[documentId]
    await saveDocument(documentId)

    useSequences.getState().drop(documentId)
    await restoreDocument(documentId)
    expect(useSequences.getState().states[documentId]).toEqual(before)
  })

  it('carries an edit chain to disk and back', async () => {
    diskBackedBridge('audio')
    const documentId = await open('audio')

    useAudioEdits.getState().replace(documentId, {
      assetId: 'asset-a',
      edits: [],
      region: null,
      bypassed: false,
    })
    useAudioEdits.getState().runCommand(documentId, pushEdit({ kind: 'gain', db: -6 }))
    const before = useAudioEdits.getState().states[documentId]
    await saveDocument(documentId)

    useAudioEdits.getState().drop(documentId)
    await restoreDocument(documentId)
    expect(useAudioEdits.getState().states[documentId]).toEqual(before)
  })

  it('carries a sky to disk and back', async () => {
    diskBackedBridge('skybox')
    const documentId = await open('skyboxes')

    useSkyboxes.getState().runCommand(documentId, setSunAngles({ elevation: 0.3, azimuth: 1 }))
    const before = useSkyboxes.getState().states[documentId]
    await saveDocument(documentId)

    useSkyboxes.getState().drop(documentId)
    await restoreDocument(documentId)
    expect(useSkyboxes.getState().states[documentId]).toEqual(before)
  })

  // The document opens clean: what is on screen is exactly what the disk holds.
  it('opens a document read back from disk unmodified', async () => {
    diskBackedBridge('sequence')
    const documentId = await open('video')

    const clip = makeClip({ id: 'clip-1', assetId: 'asset-a', start: 0, duration: 2_000_000 })
    useSequences.getState().runCommand(documentId, addClip('V1', clip))
    await saveDocument(documentId)

    useSequences.getState().drop(documentId)
    await restoreDocument(documentId)
    expect(sequenceStore.isDirty(useSequences.getState(), documentId)).toBe(false)
  })

  // A file that is not JSON at all is a read that failed, and the tab must not then write an
  // empty document over the only copy.
  it('refuses to save a sequence whose file would not read', async () => {
    const write = vi.fn(() => Promise.resolve())
    installFakeBridge({
      documents: {
        write,
        read: () =>
          Promise.resolve<DocumentFile | null>({
            version: DOCUMENT_VERSION,
            kind: 'sequence',
            title: 'Untitled',
            content: '{ not json',
            updatedAt: '2026-08-08T10:00:00.000Z',
          }),
      },
    })

    const created = await useDocuments.getState().create('video')
    if (!created) throw new Error('expected a document')
    await restoreDocument(created.id)

    await saveDocument(created.id)
    expect(write).not.toHaveBeenCalled()
  })
})
