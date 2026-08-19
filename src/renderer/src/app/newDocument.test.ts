import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { DocumentDescriptor } from '@shared/domain/document'
import type { FileFacts } from '@shared/domain/fileInfo'
import { installFakeBridge } from '@/services/fakeBridge'
import { useDocuments } from '@/stores/documents'
import { useProject } from '@/stores/project'
import { useSelection } from '@/stores/selection'
import { registerDocumentNamer, type DocumentNamer } from './documentName'
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

let release: (() => void) | null = null

const namedBy = (namer: DocumentNamer): void => {
  release = registerDocumentNamer(namer)
}

const created = (): DocumentDescriptor[] => Object.values(useDocuments.getState().documents)

describe('createDocumentIn', () => {
  beforeEach(() => {
    vi.clearAllMocks()
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

  afterEach(() => {
    release?.()
    release = null
  })

  it('calls the document what the dialog answers, and opens it', async () => {
    namedBy(() => Promise.resolve({ title: 'Niveau', folder: 'documents' }))

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
    installFakeBridge({
      documents: { list: () => Promise.resolve([stored('Scène 1', 'Scène 1.gltf')]) },
    })
    const asked = vi.fn<DocumentNamer>(() => Promise.resolve(null))
    namedBy(asked)

    createDocumentIn('3d')

    await vi.waitFor(() => expect(asked).toHaveBeenCalled())
    expect(asked.mock.calls[0]?.[0]).toMatchObject({ kind: 'scene', suggested: 'Scène 2' })
  })

  // What the field refuses a typed name against: the folder and the tabs it cannot see on disk.
  it('hands the dialog every name already spoken for', async () => {
    installFakeBridge({
      documents: { list: () => Promise.resolve([stored('Niveau', 'Niveau.gltf')]) },
    })
    useDocuments.setState({ documents: { open: stored('Brouillon', 'Brouillon.gltf') } })
    const asked = vi.fn<DocumentNamer>(() => Promise.resolve(null))
    namedBy(asked)

    createDocumentIn('3d')

    await vi.waitFor(() => expect(asked).toHaveBeenCalled())
    expect(
      asked.mock.calls[0]?.[0].takenIn('documents').map(document => document.fileName),
    ).toEqual(expect.arrayContaining(['Niveau.gltf', 'Brouillon.gltf']))
  })

  // A name is taken in ONE folder: two folders may each hold a `Niveau.gltf`, and the disk is
  // happy with both.
  it('answers what another folder holds, not what this one does', async () => {
    installFakeBridge({
      documents: { list: () => Promise.resolve([stored('Niveau', 'Niveau.gltf')]) },
    })
    const asked = vi.fn<DocumentNamer>(() => Promise.resolve(null))
    namedBy(asked)

    createDocumentIn('3d')

    await vi.waitFor(() => expect(asked).toHaveBeenCalled())
    expect(asked.mock.calls[0]?.[0].takenIn('Images')).toEqual([])
  })

  // Where the Explorer is pointing, which is where a user looking at a folder means to create.
  it('opens the field on the folder holding the picked row', async () => {
    installFakeBridge({
      project: { fileFacts: () => Promise.resolve(FILE_FACTS) },
    })
    useSelection.getState().selectFiles(['Images/Croquis/etude.jpg'])
    const asked = vi.fn<DocumentNamer>(() => Promise.resolve(null))
    namedBy(asked)

    createDocumentIn('3d')

    await vi.waitFor(() => expect(asked).toHaveBeenCalled())
    expect(asked.mock.calls[0]?.[0].folder).toBe('Images/Croquis')
  })

  it('opens the field on a picked folder itself', async () => {
    installFakeBridge({
      project: { fileFacts: () => Promise.resolve(FOLDER_FACTS) },
    })
    useSelection.getState().selectFiles(['Images/Croquis'])
    const asked = vi.fn<DocumentNamer>(() => Promise.resolve(null))
    namedBy(asked)

    createDocumentIn('3d')

    await vi.waitFor(() => expect(asked).toHaveBeenCalled())
    expect(asked.mock.calls[0]?.[0].folder).toBe('Images/Croquis')
  })

  it('falls back to the documents folder when nothing is picked', async () => {
    const asked = vi.fn<DocumentNamer>(() => Promise.resolve(null))
    namedBy(asked)

    createDocumentIn('3d')

    await vi.waitFor(() => expect(asked).toHaveBeenCalled())
    expect(asked.mock.calls[0]?.[0].folder).toBe('documents')
  })

  it('files the document in the folder the dialog answers', async () => {
    namedBy(() => Promise.resolve({ title: 'Niveau', folder: 'Images/Croquis' }))

    createDocumentIn('3d')

    await vi.waitFor(() => expect(created()).toHaveLength(1))
    expect(created()[0]?.path).toBe('Images/Croquis/Niveau.gltf')
  })

  it('makes nothing when the creation is called off', async () => {
    const asked = vi.fn<DocumentNamer>(() => Promise.resolve(null))
    namedBy(asked)

    createDocumentIn('3d')

    await vi.waitFor(() => expect(asked).toHaveBeenCalled())
    expect(created()).toHaveLength(0)
    expect(openDocument).not.toHaveBeenCalled()
  })

  // A window showing no dialog has nobody to ask, and a numbered document is a better answer
  // than a gesture that does nothing.
  it('numbers the document where no dialog is mounted', async () => {
    createDocumentIn('3d')

    await vi.waitFor(() => expect(created()).toHaveLength(1))
    expect(created()[0]?.title).toBe('Scène 1')
  })

  it('makes nothing with no project open', async () => {
    useProject.setState({ project: null })
    const asked = vi.fn<DocumentNamer>(() => Promise.resolve({ title: 'Niveau', folder: '' }))
    namedBy(asked)

    createDocumentIn('3d')
    // Long enough for the listing and the question that would have followed it.
    await new Promise(settled => setTimeout(settled, 0))

    expect(asked).not.toHaveBeenCalled()
    expect(created()).toHaveLength(0)
  })

  // A caller outside the window is held on the other end of this, and "done" for a field the
  // person called off is the one answer it must never give.
  describe('what it answers', () => {
    it('the document, once the field is filled', async () => {
      namedBy(() => Promise.resolve({ title: 'Niveau', folder: 'documents' }))

      expect(await createDocumentIn('3d')).toMatchObject({ title: 'Niveau', kind: 'scene' })
    })

    it('nothing when the field is called off', async () => {
      namedBy(() => Promise.resolve(null))

      expect(await createDocumentIn('3d')).toBeNull()
      expect(created()).toHaveLength(0)
    })

    it('nothing with no project open', async () => {
      useProject.setState({ project: null })

      expect(await createDocumentIn('3d')).toBeNull()
    })
  })

  // Naming it is what lets a caller finish the gesture alone: the field only a person can fill
  // never opens, so nothing is left waiting on a window nobody is looking at.
  describe('named by its caller', () => {
    it('makes it without raising the field', async () => {
      const asked = vi.fn<DocumentNamer>(() => Promise.resolve(null))
      namedBy(asked)

      const made = await createDocumentIn('3d', { title: 'Niveau', folder: 'Repérages' })

      expect(asked).not.toHaveBeenCalled()
      expect(made).toMatchObject({ title: 'Niveau', path: 'Repérages/Niveau.gltf' })
    })

    it('files it in the documents folder when no folder is named', async () => {
      const made = await createDocumentIn('3d', { title: 'Niveau' })

      expect(made?.path).toBe('documents/Niveau.gltf')
    })

    it('still refuses with no project open', async () => {
      useProject.setState({ project: null })

      expect(await createDocumentIn('3d', { title: 'Niveau' })).toBeNull()
    })
  })
})
