import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { DocumentDescriptor } from '@shared/domain/document'
import type { FileFacts } from '@shared/domain/fileInfo'
import type { NamedDocumentPlace, NewDocumentAsk } from '@shared/domain/newDocument'
import { installFakeBridge, type BridgeOverrides } from '@/services/fakeBridge'
import { useDocuments } from '@/stores/documents'
import { useProject } from '@/stores/project'
import { useSelection } from '@/stores/selection'
import { createDocumentIn } from './newDocument'

const openDocument = vi.fn()
vi.mock('./dockviewApi', () => ({ openDocument: (...args: unknown[]) => openDocument(...args) }))

const stored = (title: string, fileName: string): DocumentDescriptor => ({
  id: fileName,
  kind: 'scene',
  workspace: '3d',
  title,
  path: `documents/${fileName}`,
})

const FILE_FACTS: FileFacts = {
  kind: 'file',
  bytes: 1,
  createdAt: null,
  modifiedAt: '2026-08-16T10:00:00.000Z',
}

const FOLDER_FACTS: FileFacts = { ...FILE_FACTS, kind: 'folder' }

/** What the window was asked, which is the whole of what this side hands over. */
const asks: NewDocumentAsk[] = []

/** Installs the bridge with the window's answer already decided. */
const answering = (place: NamedDocumentPlace | null, overrides: BridgeOverrides = {}): void => {
  installFakeBridge({
    ...overrides,
    newDocument: {
      ask: ask => {
        asks.push(ask)
        return Promise.resolve(place)
      },
    },
  })
}

const created = (): DocumentDescriptor[] => Object.values(useDocuments.getState().documents)

describe('createDocumentIn', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    asks.length = 0
    installFakeBridge()
    useDocuments.setState({ documents: {}, stored: [] })
    useSelection.getState().clear()
    const stamp = '2026-08-16T10:00:00.000Z'
    useProject.setState({
      project: {
        path: '/projects/one',
        manifest: { version: 1, name: 'One', createdAt: stamp, updatedAt: stamp },
      },
    })
  })

  it('calls the document what the window answers, and opens it', async () => {
    answering({ title: 'Niveau', folder: 'documents' })

    createDocumentIn('3d')

    await vi.waitFor(() => expect(created()).toHaveLength(1))
    expect(created()[0]?.title).toBe('Niveau')
    // The name is the file name: there is only ever one name to change afterwards.
    expect(created()[0]?.path).toBe('documents/Niveau.gltf')
    expect(openDocument).toHaveBeenCalledWith(created()[0])
  })

  /**
   * The proposal is read off the folder as much as off the open tabs — a document saved and then
   * closed still holds its name, and counting only what is open would propose it twice.
   */
  it('proposes the first free number, reading the folder afresh', async () => {
    answering(null, {
      documents: { list: () => Promise.resolve([stored('Scène 1', 'Scène 1.gltf')]) },
    })

    createDocumentIn('3d')

    await vi.waitFor(() => expect(asks).toHaveLength(1))
    expect(asks[0]).toMatchObject({ kind: 'scene', suggested: 'Scène 2', projectName: 'One' })
  })

  // What the window cannot read for itself: a document a tab holds and no folder does yet.
  it('hands the window the documents no file holds', async () => {
    answering(null)
    useDocuments.setState({ documents: { open: stored('Brouillon', 'Brouillon.gltf') } })

    createDocumentIn('3d')

    await vi.waitFor(() => expect(asks).toHaveLength(1))
    expect(asks[0]?.open.map(document => document.path)).toEqual(['documents/Brouillon.gltf'])
  })

  // Where the Explorer is pointing, which is where a user looking at a folder means to create.
  it('opens the window on the folder holding the picked row', async () => {
    answering(null, { project: { fileFacts: () => Promise.resolve(FILE_FACTS) } })
    useSelection.getState().selectFiles(['Images/Croquis/etude.jpg'])

    createDocumentIn('3d')

    await vi.waitFor(() => expect(asks).toHaveLength(1))
    expect(asks[0]?.folder).toBe('Images/Croquis')
  })

  it('opens the window on a picked folder itself', async () => {
    answering(null, { project: { fileFacts: () => Promise.resolve(FOLDER_FACTS) } })
    useSelection.getState().selectFiles(['Images/Croquis'])

    createDocumentIn('3d')

    await vi.waitFor(() => expect(asks).toHaveLength(1))
    expect(asks[0]?.folder).toBe('Images/Croquis')
  })

  it('falls back to the documents folder when nothing is picked', async () => {
    answering(null)

    createDocumentIn('3d')

    await vi.waitFor(() => expect(asks).toHaveLength(1))
    expect(asks[0]?.folder).toBe('documents')
  })

  it('files the document in the folder the window answers', async () => {
    answering({ title: 'Niveau', folder: 'Images/Croquis' })

    createDocumentIn('3d')

    await vi.waitFor(() => expect(created()).toHaveLength(1))
    expect(created()[0]?.path).toBe('Images/Croquis/Niveau.gltf')
  })

  // Cancelled, or the window closed — the main process answers `null` for both, and nothing may
  // be made either way.
  it('makes nothing when the creation is called off', async () => {
    answering(null)

    createDocumentIn('3d')

    await vi.waitFor(() => expect(asks).toHaveLength(1))
    expect(created()).toHaveLength(0)
    expect(openDocument).not.toHaveBeenCalled()
  })

  it('makes nothing with no project open', async () => {
    answering({ title: 'Niveau', folder: '' })
    useProject.setState({ project: null })

    createDocumentIn('3d')
    // Long enough for the listing and the question that would have followed it.
    await new Promise(settled => setTimeout(settled, 0))

    expect(asks).toHaveLength(0)
    expect(created()).toHaveLength(0)
  })

  // A caller outside the window is held on the other end of this, and "done" for a window the
  // person closed is the one answer it must never give.
  describe('what it answers', () => {
    it('the document, once the window is filled', async () => {
      answering({ title: 'Niveau', folder: 'documents' })

      expect(await createDocumentIn('3d')).toMatchObject({ title: 'Niveau', kind: 'scene' })
    })

    it('nothing when the window is called off', async () => {
      answering(null)

      expect(await createDocumentIn('3d')).toBeNull()
      expect(created()).toHaveLength(0)
    })

    it('nothing with no project open', async () => {
      useProject.setState({ project: null })

      expect(await createDocumentIn('3d')).toBeNull()
    })
  })

  // Naming it is what lets a caller finish the gesture alone: the window only a person can fill
  // never opens, so nothing is left waiting on a screen nobody is looking at.
  describe('named by its caller', () => {
    it('makes it without opening the window', async () => {
      answering(null)

      const made = await createDocumentIn('3d', { title: 'Niveau', folder: 'Repérages' })

      expect(asks).toHaveLength(0)
      expect(made).toMatchObject({ title: 'Niveau', path: 'Repérages/Niveau.gltf' })
    })

    it('files it in the documents folder when no folder is named', async () => {
      const made = await createDocumentIn('3d', { title: 'Niveau' })

      expect(made?.path).toBe('documents/Niveau.gltf')
    })
  })
})
