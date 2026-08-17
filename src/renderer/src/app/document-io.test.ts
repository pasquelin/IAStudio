import { EMPTY_TIMELINE } from '@shared/domain/animation'
import type { Asset } from '@shared/domain/asset'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import {
  DOCUMENT_KINDS,
  DOCUMENT_VERSION,
  workspaceForKind,
  type DocumentWrite,
} from '@shared/domain/document'
import type {
  CloseChoice,
  DocumentDescriptor,
  DocumentDraft,
  DocumentFile,
  DocumentKind,
} from '@shared/domain/document'
import { createDefaultScene } from '@/engines/scene/default-scene'
import { addNode } from '@/engines/scene/commands'
import { meshNode } from '@/engines/scene/scene-fixtures'
import { getBridge } from '@/services/bridge'
import { bridgeWatchingLogs, installFakeBridge } from '@/services/fake-bridge'
import { useDocuments } from '@/stores/documents'
import { showPanels } from '@/stores/layout-fixtures'
import { useTextures } from '@/stores/textures'
import { newTexture } from '@/engines/texture/texture-state'
import { clearScenes } from '@/stores/scene-fixtures'
import { isSceneDirty, sceneOf, sceneStore, useScenes } from '@/stores/scenes'
import { isPartName } from '@shared/domain/document'
import { DEFAULT_CANVAS, pixelLayer } from '@/engines/canvas/canvas-state'
import { addLayer, resizeCanvas } from '@/engines/canvas/commands'
import { holdCanvas, type CanvasHost } from '@/spaces/image/canvas-hosts'
import { canvasStore, useCanvases } from '@/stores/canvases'
import { EMPTY_AUDIO_EDIT, pushEdit } from '@/engines/audio/edits'
import { addClip, removeTrack } from '@/engines/timeline/commands'
import { EMPTY_SOUND_SEQUENCE, makeClip } from '@/engines/timeline/timeline-state'
import { setSunAngles } from '@/engines/skybox/commands'
import { useAudioEdits } from '@/stores/audio-edits'
import { sequenceStore, useSequences } from '@/stores/sequences'
import { useSkyboxes } from '@/stores/skyboxes'
import { forgetReportedFailures } from '@/services/diagnostics'
import { inspectedChannel, useTextureViews } from '@/stores/texture-views'
import {
  autosaveOpenDocuments,
  closeDocument,
  deleteDocument,
  refreshDocuments,
  rehydrateDocument,
  restoreDocument,
  saveDocument,
  saveDocumentAs,
  unsavedDocumentIds,
} from './document-io'

// The real one needs a live Dockview; what this file checks is that closing and opening reach it.
const closePanel = vi.fn()
const openDocument = vi.fn()
vi.mock('./dockview-api', () => ({
  closePanel: (id: string) => closePanel(id),
  openDocument: (document: DocumentDescriptor) => openDocument(document),
}))

const box = meshNode('box-1')

/** What `savePicture` answers with — only its shape matters to a caller that discards it. */
const picture = (): Asset => ({
  id: 'asset-1',
  name: 'Gemini 3.1',
  type: 'image',
  location: 'local',
  tags: [],
  createdAt: '2026-08-12T10:00:00.000Z',
})

const savedFile = (): DocumentFile => ({
  version: DOCUMENT_VERSION,
  kind: 'scene',
  title: 'Set dressing',
  // Serialized, as it crosses the boundary: the file layer never parses a content.
  content: JSON.stringify({ nodes: [box] }),
  updatedAt: '2026-08-07T10:00:00.000Z',
})

function scene(id: string): DocumentDescriptor {
  return {
    id,
    kind: 'scene',
    title: 'Set dressing',
    workspace: '3d',
    path: `documents/${id}.scene`,
  }
}

beforeEach(() => {
  vi.clearAllMocks()
  localStorage.clear()
  clearScenes()
  forgetReportedFailures()
  useDocuments.setState({ documents: {}, activeId: null })
})

/**
 * A fake engine behind the canvas port. Written once so a member added to `CanvasHost` is one
 * edit here rather than one per case — nine of them had spelled the same stubs out.
 */
function fakeCanvas(overrides: Partial<CanvasHost> = {}): CanvasHost {
  return {
    pixelSnapshots: () => Promise.resolve([]),
    restoreSnapshot: () => Promise.resolve(),
    snapshot: () => Promise.resolve(null),
    forgetPicture: () => Promise.resolve(),
    ...overrides,
  }
}

describe('saveDocument', () => {
  const openScene = async (): Promise<string> => {
    const created = await useDocuments.getState().create('3d')
    if (!created) throw new Error('expected a document')
    useScenes.getState().runCommand(created.id, addNode(box))
    return created.id
  }

  it('writes the scene, and only what a scene is — never its selection', async () => {
    const write = vi.fn(() => Promise.resolve<DocumentWrite>('written'))
    installFakeBridge({ documents: { write } })

    const documentId = await openScene()
    await saveDocument(documentId)

    expect(write).toHaveBeenCalledWith(documentId, 'scene', {
      title: expect.any(String),
      content: JSON.stringify({
        nodes: [box],
        environment: { kind: 'studio' },
        animation: EMPTY_TIMELINE,
      }),
    })
  })

  it('marks the document clean once it is written', async () => {
    installFakeBridge({ documents: { write: () => Promise.resolve<DocumentWrite>('written') } })

    const documentId = await openScene()
    expect(isSceneDirty(useScenes.getState(), documentId)).toBe(true)

    await saveDocument(documentId)
    expect(isSceneDirty(useScenes.getState(), documentId)).toBe(false)
  })

  /**
   * A file something else wrote is not the studio's to replace on its own. Refusing leaves the
   * tab modified, which is the only place the window can say the work is not on disk.
   */
  it('asks before writing over an outside change, and writes nothing when refused', async () => {
    const write = vi.fn(() => Promise.resolve<DocumentWrite>('stale'))
    const confirmOverwrite = vi.fn(() => Promise.resolve(false))
    installFakeBridge({ documents: { write, confirmOverwrite } })

    const documentId = await openScene()

    await expect(saveDocument(documentId)).resolves.toBe(false)
    expect(confirmOverwrite).toHaveBeenCalled()
    expect(write).toHaveBeenCalledTimes(1)
    expect(isSceneDirty(useScenes.getState(), documentId)).toBe(true)
  })

  it('writes over an outside change once the user agrees, and says it insisted', async () => {
    const forced: (boolean | undefined)[] = []
    const write = (
      _id: string,
      _kind: DocumentKind,
      _draft: DocumentDraft,
      force?: boolean,
    ): Promise<DocumentWrite> => {
      forced.push(force)
      return Promise.resolve('stale')
    }
    installFakeBridge({ documents: { write, confirmOverwrite: () => Promise.resolve(true) } })

    const documentId = await openScene()
    await expect(saveDocument(documentId)).resolves.toBe(true)

    // The second call is the whole point: the first asked, the second insisted.
    expect(forced).toEqual([undefined, true])
  })

  describe('autosave', () => {
    it('writes an open document that has work in it', async () => {
      const write = vi.fn(() => Promise.resolve<DocumentWrite>('written'))
      installFakeBridge({ documents: { write } })
      const documentId = await openScene()

      await autosaveOpenDocuments()

      expect(write).toHaveBeenCalled()
      expect(isSceneDirty(useScenes.getState(), documentId)).toBe(false)
    })

    // The layers are read back off the GPU, and that cost is unmeasured: a save on a timer would
    // stutter the canvas every half-minute. ⌘S still writes it.
    it('never writes an image document', async () => {
      const write = vi.fn(() => Promise.resolve<DocumentWrite>('written'))
      installFakeBridge({ documents: { write } })
      const created = await useDocuments.getState().create('image')
      if (!created) throw new Error('expected a document')
      useCanvases.getState().ensure(created.id, () => DEFAULT_CANVAS)
      useCanvases.getState().runCommand(created.id, addLayer(pixelLayer('layer-1', 'Layer')))

      await autosaveOpenDocuments()

      expect(write).not.toHaveBeenCalled()
    })

    /**
     * A native dialog blocks the user's input, not the renderer's timers. Writing while the
     * "Save / Don't Save" question is on screen answers it for them: the tab then closes over
     * work the user had just declined to save.
     */
    it('writes nothing while a close question is on screen', async () => {
      const write = vi.fn(() => Promise.resolve<DocumentWrite>('written'))
      let answer: (choice: CloseChoice) => void = () => {}
      installFakeBridge({
        documents: { write, confirmClose: () => new Promise<CloseChoice>(r => (answer = r)) },
      })
      const documentId = await openScene()

      const closing = closeDocument(documentId)
      await autosaveOpenDocuments()
      expect(write).not.toHaveBeenCalled()

      answer('discard')
      await closing
    })

    // A dialog nobody summoned, in front of work someone is in the middle of, is worse than the
    // save it was trying to make.
    it('asks nothing when the file changed outside, and leaves it for ⌘S', async () => {
      const confirmOverwrite = vi.fn(() => Promise.resolve(true))
      installFakeBridge({
        documents: { write: () => Promise.resolve<DocumentWrite>('stale'), confirmOverwrite },
      })
      const documentId = await openScene()

      await autosaveOpenDocuments()

      expect(confirmOverwrite).not.toHaveBeenCalled()
      expect(isSceneDirty(useScenes.getState(), documentId)).toBe(true)
    })
  })

  // The marker is the only place the studio can say a document is not on disk; a failed write
  // that cleared it would claim the opposite.
  it('leaves the document modified when the write fails', async () => {
    installFakeBridge({ documents: { write: () => Promise.reject(new Error('no project')) } })

    const documentId = await openScene()
    await expect(saveDocument(documentId)).rejects.toThrow()
    expect(isSceneDirty(useScenes.getState(), documentId)).toBe(true)
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
          return new Promise<DocumentWrite>(resolve => {
            release = () => resolve('written')
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

    expect(isSceneDirty(useScenes.getState(), documentId)).toBe(true)
  })

  // The file on disk is the only copy. A read that failed leaves the tab empty and modified, and
  // the bullet invites a ⌘S — which would write `{ nodes: [] }` over the scene it could not read.
  it('refuses to write a document whose state never loaded', async () => {
    const write = vi.fn(() => Promise.resolve<DocumentWrite>('written'))
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
    const write = vi.fn(() => Promise.resolve<DocumentWrite>('written'))
    installFakeBridge({ documents: { write, read: () => Promise.reject(new Error('gone')) } })
    useDocuments.setState({ documents: { 'doc-1': scene('doc-1') } })

    await restoreDocument('doc-1')
    useScenes.getState().runCommand('doc-1', addNode(box))
    await saveDocument('doc-1')

    expect(write).not.toHaveBeenCalled()
  })

  /**
   * ⌘S writes the document and then the asset it was opened from — the second half of the
   * gesture, and what the shelf shows. It waited on `LayerSurface.fromDocument`, which is where
   * the loop it would otherwise close is written out.
   */
  describe('the asset behind the document', () => {
    const PNG = 'iVBORw0KGgo='

    /** Which pictures the engine was told to forget, so the overwrite's second half is visible. */
    let forgotten: string[] = []

    beforeEach(() => {
      forgotten = []
    })

    /** `sourceAssetId` absent is the blank document of the `+` button: it edits no asset. */
    const openImage = async (
      sourceAssetId?: string,
    ): Promise<{ documentId: string; release: () => void }> => {
      const created = await useDocuments
        .getState()
        .create('image', sourceAssetId ? { title: 'Gemini 3.1', sourceAssetId } : undefined)
      if (!created) throw new Error('expected a document')

      useCanvases.getState().ensure(created.id, () => DEFAULT_CANVAS)
      const release = holdCanvas(created.id, () =>
        fakeCanvas({
          snapshot: () => Promise.resolve(PNG),
          forgetPicture: assetId => {
            forgotten.push(assetId)
            return Promise.resolve()
          },
        }),
      )
      return { documentId: created.id, release }
    }

    /**
     * The order is the guarantee: the document holds the layers and the history, the asset only
     * a flat picture. Writing the asset first and failing on the document would leave a fresh
     * tile standing in front of work that never reached the disk.
     */
    it('writes the asset it edits, after the document', async () => {
      const order: string[] = []
      const savePicture = vi.fn(() => {
        order.push('asset')
        return Promise.resolve(picture())
      })
      installFakeBridge({
        documents: {
          write: () => {
            order.push('document')
            return Promise.resolve<DocumentWrite>('written')
          },
        },
        assets: { savePicture },
      })
      const { documentId, release } = await openImage('asset-1')
      useCanvases.getState().runCommand(documentId, addLayer(pixelLayer('layer-1', 'Layer')))

      await expect(saveDocument(documentId)).resolves.toBe(true)
      release()

      // `name` rides along because the channel is shaped like `saveAudio`'s; an overwrite keeps
      // the name the asset already has, so this is not ⌘S renaming anything.
      expect(savePicture).toHaveBeenCalledWith({
        replaces: 'asset-1',
        name: 'Gemini 3.1',
        png: PNG,
      })
      expect(order).toEqual(['document', 'asset'])
    })

    /**
     * The loader caches by URL for the session and the id does not move, so a layer placed from
     * this asset in ANOTHER document would draw the picture as it was before the save.
     */
    it('tells the engine to forget the picture it has just overwritten', async () => {
      installFakeBridge({
        documents: { write: () => Promise.resolve<DocumentWrite>('written') },
        assets: { savePicture: () => Promise.resolve(picture()) },
      })
      const { documentId, release } = await openImage('asset-1')
      useCanvases.getState().runCommand(documentId, addLayer(pixelLayer('layer-1', 'Layer')))

      await saveDocument(documentId)
      release()

      expect(forgotten).toEqual(['asset-1'])
    })

    /**
     * A crop is an edit like any other, and the flatten goes back at whatever size the document
     * has become. A save that refused a resized document would be an image editor that cannot
     * crop; what keeps an asset safe is that an untouched tab writes nothing at all.
     */
    it('writes the asset even when the document no longer measures what it did', async () => {
      const savePicture = vi.fn(() => Promise.resolve(picture()))
      installFakeBridge({
        documents: { write: () => Promise.resolve<DocumentWrite>('written') },
        assets: { savePicture },
      })
      const { documentId, release } = await openImage('asset-1')
      useCanvases.getState().runCommand(documentId, addLayer(pixelLayer('layer-1', 'Layer')))
      useCanvases.getState().runCommand(documentId, resizeCanvas(320, 200, { x: 0, y: 0 }))

      await expect(saveDocument(documentId)).resolves.toBe(true)
      release()

      expect(savePicture).toHaveBeenCalledWith({
        replaces: 'asset-1',
        name: 'Gemini 3.1',
        png: PNG,
      })
    })

    /**
     * What the window asks before it closes reads the image kind's own `dirty`, not the mark ⌘S
     * consults: a tab whose picture has been painted on is work worth a question.
     */
    it('counts a painted picture among the work a window would lose', async () => {
      installFakeBridge({ documents: { write: () => Promise.resolve<DocumentWrite>('written') } })
      const { documentId, release } = await openImage('asset-1')
      expect(unsavedDocumentIds()).toEqual([])

      useCanvases.getState().runCommand(documentId, addLayer(pixelLayer('layer-1', 'Layer')))
      release()

      expect(unsavedDocumentIds()).toEqual([documentId])
    })

    /**
     * A reflex ⌘S on a tab nobody edited must not touch its file. The asset would come back a
     * re-encoded PNG, and `replaceBytes` deletes the file whose extension no longer names it —
     * a `.jpg` opened out of curiosity would be gone.
     */
    it('leaves an untouched tab’s asset exactly as it was', async () => {
      const savePicture = vi.fn(() => Promise.resolve(picture()))
      installFakeBridge({
        documents: { write: () => Promise.resolve<DocumentWrite>('written') },
        assets: { savePicture },
      })
      const { documentId, release } = await openImage('asset-1')

      await expect(saveDocument(documentId)).resolves.toBe(true)
      release()

      expect(savePicture).not.toHaveBeenCalled()
    })

    /** The blank document of the `+` button edits no asset: ⌘S writes the file and stops there. */
    it('writes no asset for a document that edits none', async () => {
      const savePicture = vi.fn(() => Promise.resolve(picture()))
      installFakeBridge({
        documents: { write: () => Promise.resolve<DocumentWrite>('written') },
        assets: { savePicture },
      })
      const { documentId, release } = await openImage()
      useCanvases.getState().runCommand(documentId, addLayer(pixelLayer('layer-1', 'Layer')))

      await expect(saveDocument(documentId)).resolves.toBe(true)
      release()

      expect(savePicture).not.toHaveBeenCalled()
    })

    /**
     * A remount does not lose the state, so `restoreDocument` reads nothing — and the fresh
     * engine came up with the whole stack and not one pixel in it. Every layer was blank except
     * the ones carrying `source`, which redrew from their asset; and once ⌘S has written the
     * flattened stack into that asset, redrawing from it folds the whole picture into the one
     * layer it came from.
     */
    it('hands a remounted engine the pixels the document holds on disk', async () => {
      const restored: string[] = []
      installFakeBridge({
        documents: {
          write: () => Promise.resolve<DocumentWrite>('written'),
          read: () =>
            Promise.resolve({
              version: DOCUMENT_VERSION,
              kind: 'image',
              title: 'Gemini 3.1',
              content: JSON.stringify(DEFAULT_CANVAS),
              updatedAt: '2026-08-12T10:00:00.000Z',
              parts: [{ name: 'p_layer-1.png', data: 'QUJD' }],
            }),
        },
      })
      const { documentId, release } = await openImage('asset-1')
      release()

      // The engine that comes up after the switch, holding nothing.
      const remounted = holdCanvas(documentId, () =>
        fakeCanvas({
          restoreSnapshot: pixels => {
            restored.push(pixels.layerId)
            return Promise.resolve()
          },
        }),
      )
      await rehydrateDocument(documentId)
      remounted()

      expect(restored).toEqual(['layer-1'])
    })

    // Said out loud rather than swallowed: a remount that came back blank because the file would
    // not read is indistinguishable from one that came back blank because there was nothing in it.
    it('says so when the file it would read back refuses', async () => {
      const { entries } = bridgeWatchingLogs({
        documents: {
          write: () => Promise.resolve<DocumentWrite>('written'),
          read: () => Promise.reject(new Error('gone')),
        },
      })
      const { documentId, release } = await openImage('asset-1')
      release()

      await rehydrateDocument(documentId)

      expect(entries()[0]).toMatchObject({ scope: 'document.load' })
    })

    /**
     * Only a kind whose pixels live outside its state has anything to hand back, which is the
     * image alone — a scene, a sky or a montage is entirely in the string it was written as.
     */
    it('reads nothing back for a kind that keeps everything in its state', async () => {
      const read = vi.fn(() => Promise.resolve(savedFile()))
      installFakeBridge({
        documents: { write: () => Promise.resolve<DocumentWrite>('written'), read },
      })

      const documentId = await openScene()
      await rehydrateDocument(documentId)

      expect(read).not.toHaveBeenCalled()
    })

    // A document saved before it held any pixels has no parts, and that is not a failure.
    it('hands nothing back when the file carries no pixels', async () => {
      installFakeBridge({
        documents: {
          write: () => Promise.resolve<DocumentWrite>('written'),
          read: () =>
            Promise.resolve({
              version: DOCUMENT_VERSION,
              kind: 'image',
              title: 'Gemini 3.1',
              content: JSON.stringify(DEFAULT_CANVAS),
              updatedAt: '2026-08-12T10:00:00.000Z',
            }),
        },
      })
      const restored: string[] = []
      const { documentId, release } = await openImage('asset-1')
      release()

      const remounted = holdCanvas(documentId, () =>
        fakeCanvas({
          restoreSnapshot: pixels => {
            restored.push(pixels.layerId)
            return Promise.resolve()
          },
        }),
      )
      await rehydrateDocument(documentId)
      remounted()

      expect(restored).toEqual([])
    })

    // `restoreDocument` owns the empty tab; both reading would race two installs onto it.
    it('leaves a document that has not been filled to the reader that fills it', async () => {
      const read = vi.fn(() => Promise.resolve(null))
      installFakeBridge({
        documents: { write: () => Promise.resolve<DocumentWrite>('written'), read },
      })
      useDocuments.setState({
        documents: {
          'doc-1': {
            id: 'doc-1',
            kind: 'image',
            title: 'x',
            workspace: 'image',
            path: 'documents/x.img',
          },
        },
      })

      await rehydrateDocument('doc-1')

      expect(read).not.toHaveBeenCalled()
    })

    /**
     * `commit` clears the dirty mark the moment the document reaches disk, so "was edited" is
     * true exactly once — a failed asset half would otherwise never be tried again, and the
     * shelf would stand on the pre-edit picture for good with no bullet to say so.
     */
    it('writes the asset on the next ⌘S after one that failed', async () => {
      let refuse = true
      const savePicture = vi.fn(() => {
        if (refuse) return Promise.reject(new Error('disk full'))
        return Promise.resolve(picture())
      })
      bridgeWatchingLogs({
        documents: { write: () => Promise.resolve<DocumentWrite>('written') },
        assets: { savePicture },
      })
      const { documentId, release } = await openImage('asset-1')
      useCanvases.getState().runCommand(documentId, addLayer(pixelLayer('layer-1', 'Layer')))

      await saveDocument(documentId)
      // Nothing was edited in between, and the document is clean: only the debt makes it retry.
      refuse = false
      await saveDocument(documentId)
      release()

      expect(savePicture).toHaveBeenCalledTimes(2)
    })

    /**
     * `null` is "nothing to bake yet" — an engine still bringing its GPU context up, which is
     * exactly when a ⌘S after switching workspace lands. Treated as a success it left every
     * consumer of the asset on the pre-edit picture, and said nothing.
     */
    it('says so, and retries, when there was nothing to bake yet', async () => {
      const savePicture = vi.fn(() => Promise.resolve(picture()))
      const { entries } = bridgeWatchingLogs({
        documents: { write: () => Promise.resolve<DocumentWrite>('written') },
        assets: { savePicture },
      })
      const created = await useDocuments
        .getState()
        .create('image', { title: 'Gemini 3.1', sourceAssetId: 'asset-1' })
      if (!created) throw new Error('expected a document')
      useCanvases.getState().ensure(created.id, () => DEFAULT_CANVAS)

      const booting = holdCanvas(created.id, () => fakeCanvas())
      useCanvases.getState().runCommand(created.id, addLayer(pixelLayer('layer-1', 'Layer')))
      await saveDocument(created.id)
      booting()

      expect(savePicture).not.toHaveBeenCalled()
      expect(entries()[0]).toMatchObject({ scope: 'assets.save' })

      // The engine is up now, and the debt is what brings the asset back into line.
      const ready = holdCanvas(created.id, () =>
        fakeCanvas({ snapshot: () => Promise.resolve(PNG) }),
      )
      await saveDocument(created.id)
      ready()

      expect(savePicture).toHaveBeenCalledTimes(1)
    })

    /**
     * The document is written, which is the point; the tile is the half that is late, and the
     * next ⌘S catches it up. Marking the document dirty again would offer to save work that is
     * already on disk.
     */
    it('keeps the document written when the asset is refused', async () => {
      const { entries } = bridgeWatchingLogs({
        documents: { write: () => Promise.resolve<DocumentWrite>('written') },
        assets: { savePicture: () => Promise.reject(new Error('disk full')) },
      })
      const { documentId, release } = await openImage('asset-1')
      useCanvases.getState().runCommand(documentId, addLayer(pixelLayer('layer-1', 'Layer')))

      await expect(saveDocument(documentId)).resolves.toBe(true)
      release()

      expect(canvasStore.hasUnsavedWork(useCanvases.getState(), documentId)).toBe(false)
      expect(entries()[0]).toMatchObject({ scope: 'assets.save' })
    })

    /**
     * The take is a REPLAYABLE chain over a decoded source: baking it into that source would
     * leave the chain in the document and apply it a second time on the next open — normalised
     * twice, faded twice, with the pre-edit audio nowhere. The editor's own toolbar offers both
     * writes, where a hand asks for them.
     */
    it('leaves a take alone too, chain and all', async () => {
      const saveAudio = vi.fn(() => Promise.resolve(picture()))
      installFakeBridge({
        documents: { write: () => Promise.resolve<DocumentWrite>('written') },
        assets: { saveAudio },
      })

      const created = await useDocuments
        .getState()
        .create('audio', { title: 'pad.wav', sourceAssetId: 'asset-take' })
      if (!created) throw new Error('expected a document')
      useAudioEdits
        .getState()
        .runCommand(created.id, pushEdit('clip-a', { kind: 'normalize', targetLufs: -14 }))

      await expect(saveDocument(created.id)).resolves.toBe(true)

      expect(saveAudio).not.toHaveBeenCalled()
    })
  })

  /**
   * ⌘⇧S: the asset that was open stays as the last ⌘S left it, and the tab carries on with a
   * copy — the gesture every application has, applied to an asset rather than to a file.
   */
  describe('saveDocumentAs', () => {
    const PNG = 'iVBORw0KGgo='

    /** What the engine was told to forget — nothing, for a gesture that overwrites nothing. */
    let forgotten: string[] = []

    beforeEach(() => {
      forgotten = []
    })

    const openLinkedImage = async (): Promise<{ documentId: string; release: () => void }> => {
      const created = await useDocuments
        .getState()
        .create('image', { title: 'Gemini 3.1', sourceAssetId: 'asset-1' })
      if (!created) throw new Error('expected a document')

      useCanvases.getState().ensure(created.id, () => DEFAULT_CANVAS)
      const release = holdCanvas(created.id, () =>
        fakeCanvas({
          snapshot: () => Promise.resolve(PNG),
          forgetPicture: assetId => {
            forgotten.push(assetId)
            return Promise.resolve()
          },
        }),
      )
      return { documentId: created.id, release }
    }

    it('writes a copy beside the asset rather than over it', async () => {
      const savePicture = vi.fn(() => Promise.resolve(picture()))
      installFakeBridge({
        documents: { write: () => Promise.resolve<DocumentWrite>('written') },
        assets: { savePicture },
      })
      const { documentId, release } = await openLinkedImage()

      await expect(saveDocumentAs(documentId)).resolves.toBe(true)
      release()

      expect(savePicture).toHaveBeenCalledWith({
        derivedFrom: 'asset-1',
        name: 'Gemini 3.1 copie',
        png: PNG,
      })
      // The original's picture is untouched, so the loader's copy of it is still the truth.
      expect(forgotten).toEqual([])
    })

    // The tab carries on with the copy: a second ⌘S must land on the new asset, not the old one.
    it('opens a document linked to the copy, and leaves the first one alone', async () => {
      installFakeBridge({
        documents: { write: () => Promise.resolve<DocumentWrite>('written') },
        assets: { savePicture: () => Promise.resolve(picture()) },
      })
      const { documentId, release } = await openLinkedImage()

      await saveDocumentAs(documentId)
      release()

      const documents = Object.values(useDocuments.getState().documents)
      expect(documents).toHaveLength(2)
      expect(documents.at(-1)).toMatchObject({
        title: 'Gemini 3.1 copie',
        sourceAssetId: 'asset-1',
      })
      // The original tab keeps pointing at the original asset.
      expect(useDocuments.getState().documents[documentId]?.sourceAssetId).toBe('asset-1')
    })

    /** A blank document edits no asset, so there is nothing to copy — and it says so. */
    it('refuses a document that edits no asset, out loud', async () => {
      const { entries } = bridgeWatchingLogs({
        documents: { write: () => Promise.resolve<DocumentWrite>('written') },
      })

      await expect(saveDocumentAs(await openScene())).resolves.toBe(false)

      expect(entries()).toHaveLength(1)
      // `assets.copy`, never `assets.save`: ⇧⌘S makes a copy and rewrites nothing, so every
      // refusal here is a copy that was not made — not a save that failed.
      expect(entries()[0]).toMatchObject({ scope: 'assets.copy' })
    })

    // Nothing baked means nothing to copy: no second document is opened onto an asset that was
    // never written, which would be a tab pointing at a picture that does not exist.
    it('opens nothing when the picture cannot be extracted yet', async () => {
      const { entries } = bridgeWatchingLogs({
        documents: { write: () => Promise.resolve<DocumentWrite>('written') },
      })
      const created = await useDocuments
        .getState()
        .create('image', { title: 'Gemini 3.1', sourceAssetId: 'asset-1' })
      if (!created) throw new Error('expected a document')

      useCanvases.getState().ensure(created.id, () => DEFAULT_CANVAS)
      const release = holdCanvas(created.id, () => fakeCanvas())

      await expect(saveDocumentAs(created.id)).resolves.toBe(false)
      release()

      expect(Object.keys(useDocuments.getState().documents)).toHaveLength(1)
      expect(entries()[0]).toMatchObject({ scope: 'assets.copy' })
    })

    // No engine at all, as opposed to one whose context is still coming up: both mean there are
    // no pixels to bake, and neither may open a tab onto an asset that was never written.
    it('opens nothing when no engine holds the document', async () => {
      const { entries } = bridgeWatchingLogs({
        documents: { write: () => Promise.resolve<DocumentWrite>('written') },
      })
      const created = await useDocuments
        .getState()
        .create('image', { title: 'Gemini 3.1', sourceAssetId: 'asset-1' })
      if (!created) throw new Error('expected a document')
      useCanvases.getState().ensure(created.id, () => DEFAULT_CANVAS)

      await expect(saveDocumentAs(created.id)).resolves.toBe(false)

      expect(entries()[0]).toMatchObject({ scope: 'assets.copy' })
    })

    it('says so when the copy itself is refused', async () => {
      const { entries } = bridgeWatchingLogs({
        documents: { write: () => Promise.resolve<DocumentWrite>('written') },
        assets: { savePicture: () => Promise.reject(new Error('disk full')) },
      })
      const { documentId, release } = await openLinkedImage()

      await expect(saveDocumentAs(documentId)).resolves.toBe(false)
      release()

      expect(entries()[0]).toMatchObject({ scope: 'assets.copy' })
    })

    /**
     * The copy is what reached the disk, so the copy is what opens clean. Marking the ORIGINAL
     * saved is the trap: `capture` closes over its id, and calling its `commit` would clear the
     * bullet of a tab whose file was never rewritten — it would then close without a word, and
     * the work in it would go with it.
     */
    it('leaves the original tab modified, since nothing was written for it', async () => {
      installFakeBridge({
        documents: { write: () => Promise.resolve<DocumentWrite>('written') },
        assets: { savePicture: () => Promise.resolve(picture()) },
      })
      const { documentId, release } = await openLinkedImage()
      useCanvases.getState().runCommand(documentId, addLayer(pixelLayer('layer-1', 'Layer')))
      expect(canvasStore.hasUnsavedWork(useCanvases.getState(), documentId)).toBe(true)

      await expect(saveDocumentAs(documentId)).resolves.toBe(true)
      release()

      // The copy is on disk and opens clean; the original's own file was never rewritten.
      expect(canvasStore.hasUnsavedWork(useCanvases.getState(), documentId)).toBe(true)
      const copy = Object.values(useDocuments.getState().documents).at(-1)
      expect(canvasStore.hasUnsavedWork(useCanvases.getState(), copy?.id ?? '')).toBe(false)
    })

    /** A document nothing could read must not be copied either: the copy would hold nothing. */
    it('refuses a document whose file would not read', async () => {
      installFakeBridge({
        documents: {
          write: () => Promise.resolve<DocumentWrite>('written'),
          read: () => Promise.reject(new Error('gone')),
        },
      })
      useDocuments.setState({ documents: { 'doc-1': scene('doc-1') } })

      await restoreDocument('doc-1')
      await expect(saveDocumentAs('doc-1')).resolves.toBe(false)
    })
  })

  it('writes nothing for a space that has no serialized form yet', async () => {
    const write = vi.fn(() => Promise.resolve<DocumentWrite>('written'))
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
    expect(isSceneDirty(useScenes.getState(), 'doc-1')).toBe(false)
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
    expect(isSceneDirty(useScenes.getState(), 'doc-1')).toBe(true)
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
    expect(isSceneDirty(useScenes.getState(), 'doc-1')).toBe(true)
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

  // The empty editor a failed read leaves is indistinguishable from a new document, and the
  // refusal to save it then reads as a ⌘S that does nothing. This is the only place that knows.
  it('reports a document whose file would not read', async () => {
    const bridge = bridgeWatchingLogs({
      documents: { read: () => Promise.reject(new Error('gone')) },
    })
    useDocuments.setState({ documents: { 'doc-1': scene('doc-1') } })

    await restoreDocument('doc-1')

    expect(bridge.entries()[0]).toMatchObject({
      level: 'error',
      scope: 'document.load',
      message: expect.stringContaining('gone'),
    })
  })

  it('says nothing for a document the project simply holds no file for', async () => {
    const bridge = bridgeWatchingLogs({ documents: { read: () => Promise.resolve(null) } })
    useDocuments.setState({ documents: { 'doc-2': scene('doc-2') } })

    await restoreDocument('doc-2')
    expect(bridge.entries()).toEqual([])
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
      useDocuments.setState({
        documents: { [id]: { id, kind, title: kind, workspace, path: `documents/${kind}${id}` } },
      })
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
          return Promise.resolve<DocumentWrite>('written')
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
    const write = vi.fn(() => Promise.resolve<DocumentWrite>('written'))
    installFakeBridge({ documents: { write } })
    const documentId = await openImage()
    const release = holdCanvas(documentId, () =>
      fakeCanvas({
        pixelSnapshots: () =>
          Promise.resolve([
            { layerId: 'layer-1', mask: false, data: PIXELS },
            { layerId: 'layer-1', mask: true, data: PIXELS },
          ]),
      }),
    )

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
          return Promise.resolve<DocumentWrite>('written')
        },
      },
    })
    const documentId = await openImage()
    const release = holdCanvas(documentId, () =>
      fakeCanvas({
        pixelSnapshots: () => Promise.resolve([{ layerId: 'a-b_1', mask: true, data: PIXELS }]),
      }),
    )

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
    const write = vi.fn(() => Promise.resolve<DocumentWrite>('written'))
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
          return Promise.resolve<DocumentWrite>('written')
        },
      },
    })
    const documentId = await openImage()
    const release = holdCanvas(documentId, () =>
      fakeCanvas({
        pixelSnapshots: () =>
          Promise.resolve([
            { layerId: 'x-mask', mask: false, data: PIXELS },
            { layerId: 'x', mask: true, data: PIXELS },
          ]),
      }),
    )

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
          return Promise.resolve<DocumentWrite>('written')
        },
      },
    })
    const documentId = await openImage()
    const release = holdCanvas(documentId, () =>
      fakeCanvas({
        pixelSnapshots: () =>
          Promise.resolve([
            { layerId: 'a b', mask: false, data: PIXELS },
            { layerId: 'fine', mask: false, data: PIXELS },
          ]),
      }),
    )

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
        [documentId]: {
          id: documentId,
          kind: 'image',
          workspace: 'image',
          title: 'Poster',
          path: 'documents/Poster.img',
        },
      },
      activeId: documentId,
    })
    const release = holdCanvas(documentId, () =>
      fakeCanvas({
        restoreSnapshot,
      }),
    )

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
        [documentId]: {
          id: documentId,
          kind: 'image',
          workspace: 'image',
          title: 'Poster',
          path: 'documents/Poster.img',
        },
      },
      activeId: documentId,
    })
    const release = holdCanvas(documentId, () =>
      fakeCanvas({
        restoreSnapshot,
      }),
    )

    await restoreDocument(documentId)
    release()

    expect(restoreSnapshot).not.toHaveBeenCalled()
  })
})

/**
 * The kinds a string holds. What is checked is the whole round trip rather than either half: a
 * serializer and a reader that agree only with themselves would pass two separate tests and
 * still lose the document.
 */
describe('the kinds a string holds', () => {
  /** Writes to memory and reads back, which is what a project folder does. */
  const diskBackedBridge = (kind: DocumentKind): void => {
    const written = new Map<string, string>()
    installFakeBridge({
      documents: {
        write: (id: string, _kind: DocumentKind, draft: DocumentDraft) => {
          written.set(id, draft.content)
          return Promise.resolve<DocumentWrite>('written')
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

    const clip = makeClip({ id: 'clip-a', assetId: 'asset-a', start: 0, duration: 2_000_000 })
    useSequences.getState().runCommand(documentId, addClip('A1', clip))
    useAudioEdits.getState().runCommand(documentId, pushEdit('clip-a', { kind: 'gain', db: -6 }))
    const before = useAudioEdits.getState().states[documentId]
    await saveDocument(documentId)

    useAudioEdits.getState().drop(documentId)
    await restoreDocument(documentId)
    expect(useAudioEdits.getState().states[documentId]).toEqual(before)
  })

  /**
   * A block deleted from the montage leaves its chain in the STORE, and has to: ⌘Z of the
   * deletion gives the block back, and its settings with it. But the file is where a block is
   * gone for good — left in, a long session grows a document without bound behind chains
   * nothing on screen can reach.
   */
  it('leaves behind the chains of blocks the montage no longer holds', async () => {
    diskBackedBridge('audio')
    const documentId = await open('audio')

    useAudioEdits.getState().runCommand(documentId, pushEdit('clip-gone', { kind: 'gain', db: -6 }))
    await saveDocument(documentId)

    useAudioEdits.getState().drop(documentId)
    await restoreDocument(documentId)

    expect(useAudioEdits.getState().states[documentId]).toEqual(EMPTY_AUDIO_EDIT)
  })

  // Both halves of a take are one document: the chain over the sample, and the montage under it.
  it('carries the sound montage of a take to disk and back', async () => {
    diskBackedBridge('audio')
    const documentId = await open('audio')

    const clip = makeClip({ id: 'clip-1', assetId: 'asset-a', start: 0, duration: 2_000_000 })
    useSequences.getState().runCommand(documentId, addClip('A1', clip))
    const before = useSequences.getState().states[documentId]
    await saveDocument(documentId)

    useSequences.getState().drop(documentId)
    useAudioEdits.getState().drop(documentId)
    await restoreDocument(documentId)

    expect(useSequences.getState().states[documentId]).toEqual(before)
  })

  // `parseSequence` answers `EMPTY_SEQUENCE` — a PICTURE track — for a montage with nothing left
  // in it, and removing the last track is a gesture the menu offers.
  it('reopens a take whose montage was emptied without handing it a picture track', async () => {
    diskBackedBridge('audio')
    const documentId = await open('audio')

    for (const track of useSequences.getState().states[documentId]?.tracks ?? []) {
      useSequences.getState().runCommand(documentId, removeTrack(track.id))
    }
    await saveDocument(documentId)

    useSequences.getState().drop(documentId)
    useAudioEdits.getState().drop(documentId)
    await restoreDocument(documentId)

    expect(useSequences.getState().states[documentId]).toEqual(EMPTY_SOUND_SEQUENCE)
  })

  /**
   * A file written before takes had a montage, and before a chain belonged to a block. It
   * reopens with an empty montage rather than refusing — and its chain, which named no block,
   * has nowhere to land: the editor edits blocks now. The take is an asset and is not lost.
   */
  it('opens a take saved with no montage at all', async () => {
    diskBackedBridge('audio')
    const documentId = await open('audio')

    await getBridge()?.documents.write(documentId, 'audio', {
      title: 'Untitled',
      content: JSON.stringify({
        assetId: 'asset-a',
        edits: [{ kind: 'trimSilence' }],
        region: null,
        bypassed: false,
      }),
    })

    useSequences.getState().drop(documentId)
    useAudioEdits.getState().drop(documentId)
    await restoreDocument(documentId)

    expect(useAudioEdits.getState().states[documentId]).toEqual(EMPTY_AUDIO_EDIT)
    expect(useSequences.getState().states[documentId]).toEqual(EMPTY_SOUND_SEQUENCE)
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
    const write = vi.fn(() => Promise.resolve<DocumentWrite>('written'))
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

/**
 * Closing, which until now no caller ever did: `useDocuments.close` had none, `documents.remove`
 * had none, and the modified bullet was consulted by nobody on the way out. What is checked is
 * the order — the question, then the write, then the forgetting — because getting it wrong loses
 * exactly the work the dialog promised to keep.
 */
describe('closing a document', () => {
  const openDirtyScene = async (): Promise<string> => {
    installFakeBridge({ documents: { write: () => Promise.resolve<DocumentWrite>('written') } })
    const created = await useDocuments.getState().create('3d')
    if (!created) throw new Error('expected a document')
    useScenes.getState().runCommand(created.id, addNode(box))
    return created.id
  }

  /**
   * A tab opened and never touched carries the bullet — nothing of it is on disk — but holds
   * nothing anyone would miss. Asking turns every stray ⌘W into a modal question about a
   * document that does not exist yet.
   */
  it('never asks about a tab that was opened and never touched', async () => {
    const confirmClose = vi.fn(() => Promise.resolve<CloseChoice>('cancel'))
    installFakeBridge({ documents: { confirmClose } })

    const created = await useDocuments.getState().create('3d')
    if (!created) throw new Error('expected a document')
    useScenes.getState().ensure(created.id, createDefaultScene)

    await expect(closeDocument(created.id)).resolves.toBe(true)
    expect(confirmClose).not.toHaveBeenCalled()
  })

  // The tab still says it is not on disk — that is the bullet's question, not this one.
  it('still calls that untouched document modified on its tab', async () => {
    installFakeBridge({})
    const created = await useDocuments.getState().create('3d')
    if (!created) throw new Error('expected a document')
    useScenes.getState().ensure(created.id, createDefaultScene)

    expect(isSceneDirty(useScenes.getState(), created.id)).toBe(true)
  })

  /**
   * `saveDocument` refuses to write a document whose file would not read — the empty editor it
   * left is indistinguishable from a new one, and the file is the only copy. Answering "save"
   * used to close the tab anyway: nothing written, and the state thrown away.
   */
  it('keeps the tab open when the save it was asked for is refused', async () => {
    const write = vi.fn(() => Promise.resolve<DocumentWrite>('written'))
    installFakeBridge({
      documents: {
        write,
        read: () => Promise.reject(new Error('gone')),
        confirmClose: () => Promise.resolve<CloseChoice>('save'),
      },
    })
    useDocuments.setState({ documents: { 'doc-1': scene('doc-1') } })

    await restoreDocument('doc-1')
    useScenes.getState().runCommand('doc-1', addNode(box))

    await expect(closeDocument('doc-1')).resolves.toBe(false)
    expect(write).not.toHaveBeenCalled()
    expect(useDocuments.getState().documents['doc-1']).toBeDefined()
  })

  it('closes a clean document without asking anything', async () => {
    const confirmClose = vi.fn(() => Promise.resolve<CloseChoice>('cancel'))
    installFakeBridge({
      documents: { confirmClose, write: () => Promise.resolve<DocumentWrite>('written') },
    })

    const created = await useDocuments.getState().create('3d')
    if (!created) throw new Error('expected a document')
    useScenes.getState().ensure(created.id, createDefaultScene)
    useScenes.getState().markSaved(created.id, sceneStore.markOf(useScenes.getState(), created.id))

    await expect(closeDocument(created.id)).resolves.toBe(true)
    expect(confirmClose).not.toHaveBeenCalled()
  })

  it('writes the document when the answer is save', async () => {
    const documentId = await openDirtyScene()
    const write = vi.fn(() => Promise.resolve<DocumentWrite>('written'))
    installFakeBridge({
      documents: { write, confirmClose: () => Promise.resolve<CloseChoice>('save') },
    })

    await expect(closeDocument(documentId)).resolves.toBe(true)
    expect(write).toHaveBeenCalledTimes(1)
    expect(useDocuments.getState().documents[documentId]).toBeUndefined()
  })

  it('throws the work away when the answer is discard', async () => {
    const documentId = await openDirtyScene()
    const write = vi.fn(() => Promise.resolve<DocumentWrite>('written'))
    installFakeBridge({
      documents: { write, confirmClose: () => Promise.resolve<CloseChoice>('discard') },
    })

    await expect(closeDocument(documentId)).resolves.toBe(true)
    expect(write).not.toHaveBeenCalled()
    expect(useDocuments.getState().documents[documentId]).toBeUndefined()
  })

  /**
   * A session view is not the document's state, so no `DocumentIo` drops it — `forgetDocument` has
   * to. The project folder hands ids out again, and a tab reopened on a reissued id would have
   * opened on the flat view of the document before it.
   */
  it('forgets which channel a closed texture was being looked at through', async () => {
    installFakeBridge({})
    const created = await useDocuments.getState().create('textures')
    if (!created) throw new Error('expected a document')
    useTextureViews.getState().inspect(created.id, 'normal')

    await expect(closeDocument(created.id)).resolves.toBe(true)

    expect(inspectedChannel(useTextureViews.getState(), created.id)).toBeNull()
  })

  /**
   * A project change does not close tab by tab: `refresh` rewrites the store's map in one write,
   * so the documents it drops never pass through `forgetDocument` — and their session views
   * outlived the project they belonged to.
   */
  it('forgets the session views of documents a project change dropped', async () => {
    installFakeBridge({})
    const left = await useDocuments.getState().create('textures')
    const kept = await useDocuments.getState().create('textures')
    if (!left || !kept) throw new Error('expected two documents')
    useTextureViews.getState().inspect(left.id, 'normal')
    useTextureViews.getState().inspect(kept.id, 'roughness')
    // The state a `DocumentIo` holds only exists once something has opened the document.
    useTextures.getState().ensure(left.id, newTexture)
    useTextures.getState().ensure(kept.id, newTexture)

    // The folder of the project being opened holds one of the two, and the layout says it is
    // open — which is what makes the other one a tab the refresh drops.
    installFakeBridge({ documents: { list: () => Promise.resolve([kept]) } })
    showPanels('textures', kept.id)

    await expect(refreshDocuments()).resolves.toBe(true)

    expect(inspectedChannel(useTextureViews.getState(), left.id)).toBeNull()
    expect(inspectedChannel(useTextureViews.getState(), kept.id)).toBe('roughness')
    // The heavy half: `ioOf` reads the kind from the map the refresh has just emptied, so the
    // engine state was the one thing a project change could not drop.
    expect(useTextures.getState().states[left.id]).toBeUndefined()
    expect(useTextures.getState().states[kept.id]).toBeDefined()
  })

  it('leaves the flat view of a document it did not close alone', async () => {
    installFakeBridge({})
    const closing = await useDocuments.getState().create('textures')
    if (!closing) throw new Error('expected a document')
    useTextureViews.getState().inspect('elsewhere', 'roughness')

    await expect(closeDocument(closing.id)).resolves.toBe(true)

    expect(inspectedChannel(useTextureViews.getState(), 'elsewhere')).toBe('roughness')
  })

  // Cancel is the one answer that leaves everything as it was — including the state and the
  // history, which a tab reopened a second later would otherwise come back to empty.
  it('leaves the document open and intact when the answer is cancel', async () => {
    const documentId = await openDirtyScene()
    installFakeBridge({ documents: { confirmClose: () => Promise.resolve<CloseChoice>('cancel') } })

    await expect(closeDocument(documentId)).resolves.toBe(false)
    expect(useDocuments.getState().documents[documentId]).toBeDefined()
    expect(sceneOf(useScenes.getState(), documentId).nodes).toEqual([box])
  })

  // A save that fails must not have already thrown the work away.
  it('keeps the document open when the write it was asked for fails', async () => {
    const documentId = await openDirtyScene()
    installFakeBridge({
      documents: {
        write: () => Promise.reject(new Error('no project')),
        confirmClose: () => Promise.resolve<CloseChoice>('save'),
      },
    })

    await expect(closeDocument(documentId)).rejects.toThrow()
    expect(useDocuments.getState().documents[documentId]).toBeDefined()
    expect(isSceneDirty(useScenes.getState(), documentId)).toBe(true)
  })

  it('takes the tab away with the document', async () => {
    const documentId = await openDirtyScene()
    installFakeBridge({
      documents: { confirmClose: () => Promise.resolve<CloseChoice>('discard') },
    })

    await closeDocument(documentId)
    expect(closePanel).toHaveBeenCalledWith(documentId)
  })

  // The id is the project folder's to hand out again: a document reopened later must not inherit
  // the refusal to save passed on the one before it.
  it('forgets that a closed document would not read', async () => {
    installFakeBridge({
      documents: {
        read: () => Promise.reject(new Error('gone')),
        confirmClose: () => Promise.resolve<CloseChoice>('discard'),
        write: () => Promise.resolve<DocumentWrite>('written'),
      },
    })
    useDocuments.setState({ documents: { 'doc-1': scene('doc-1') } })
    await restoreDocument('doc-1')
    await closeDocument('doc-1')

    // Reopened under the same id, now readable: the verdict must not have followed it.
    const write = vi.fn(() => Promise.resolve<DocumentWrite>('written'))
    installFakeBridge({ documents: { write, read: () => Promise.resolve(savedFile()) } })
    useDocuments.setState({ documents: { 'doc-1': scene('doc-1') } })
    await restoreDocument('doc-1')
    useScenes.getState().runCommand('doc-1', addNode(meshNode('box-2')))

    await saveDocument('doc-1')
    expect(write).toHaveBeenCalled()
  })

  it('drops the state and the history a closed document was holding', async () => {
    const documentId = await openDirtyScene()
    installFakeBridge({
      documents: { confirmClose: () => Promise.resolve<CloseChoice>('discard') },
    })

    await closeDocument(documentId)
    expect(useScenes.getState().states[documentId]).toBeUndefined()
    expect(useScenes.getState().histories[documentId]).toBeUndefined()
  })
})

describe('deleting a document', () => {
  const openScene = async (): Promise<string> => {
    const created = await useDocuments.getState().create('3d')
    if (!created) throw new Error('expected a document')
    useScenes.getState().ensure(created.id, createDefaultScene)
    return created.id
  }

  // Left standing, a double-click on the row would open an empty document under the same id,
  // and the next ⌘S would write back what was just deleted.
  it('re-reads the folder so the deleted row goes with the file', async () => {
    const list = vi.fn(() => Promise.resolve<DocumentDescriptor[]>([]))
    installFakeBridge({
      documents: {
        list,
        remove: () => Promise.resolve(),
        confirmDelete: () => Promise.resolve(true),
      },
    })
    const documentId = await openScene()
    list.mockClear()

    await deleteDocument(documentId)
    expect(list).toHaveBeenCalled()
  })

  it('removes the file and closes the tab once confirmed', async () => {
    const remove = vi.fn(() => Promise.resolve())
    installFakeBridge({ documents: { remove, confirmDelete: () => Promise.resolve(true) } })
    const documentId = await openScene()

    await expect(deleteDocument(documentId)).resolves.toBe(true)
    expect(remove).toHaveBeenCalledWith(documentId, 'scene')
    expect(useDocuments.getState().documents[documentId]).toBeUndefined()
  })

  it('touches nothing when the confirmation is declined', async () => {
    const remove = vi.fn(() => Promise.resolve())
    installFakeBridge({ documents: { remove, confirmDelete: () => Promise.resolve(false) } })
    const documentId = await openScene()

    await expect(deleteDocument(documentId)).resolves.toBe(false)
    expect(remove).not.toHaveBeenCalled()
    expect(useDocuments.getState().documents[documentId]).toBeDefined()
  })

  // The file is going: writing it on the way out would save and delete in the same breath.
  it('never offers to save the work of a document being deleted', async () => {
    const write = vi.fn(() => Promise.resolve<DocumentWrite>('written'))
    const confirmClose = vi.fn(() => Promise.resolve<CloseChoice>('save'))
    installFakeBridge({
      documents: { write, confirmClose, confirmDelete: () => Promise.resolve(true) },
    })
    const documentId = await openScene()
    useScenes.getState().runCommand(documentId, addNode(box))

    await deleteDocument(documentId)
    expect(confirmClose).not.toHaveBeenCalled()
    expect(write).not.toHaveBeenCalled()
  })
})
