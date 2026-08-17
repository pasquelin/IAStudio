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
    expect(created()[0]?.path).toBe('documents/Niveau.scene')
    expect(openDocument).toHaveBeenCalledWith(created()[0])
  })

  /**
   * The proposal is read off the folder as much as off the open tabs — a document saved and then
   * closed still holds its name, and counting only what is open would propose it twice.
   */
  it('proposes the first free number, reading the folder afresh', async () => {
    installFakeBridge({
      documents: { list: () => Promise.resolve([stored('Sans titre 1', 'Sans titre 1.scene')]) },
    })
    const asked = vi.fn<DocumentNamer>(() => Promise.resolve(null))
    namedBy(asked)

    createDocumentIn('3d')

    await vi.waitFor(() => expect(asked).toHaveBeenCalled())
    expect(asked.mock.calls[0]?.[0]).toMatchObject({ kind: 'scene', suggested: 'Sans titre 2' })
  })

  // What the field refuses a typed name against: the folder and the tabs it cannot see on disk.
  it('hands the dialog every name already spoken for', async () => {
    installFakeBridge({
      documents: { list: () => Promise.resolve([stored('Niveau', 'Niveau.scene')]) },
    })
    useDocuments.setState({ documents: { open: stored('Brouillon', 'Brouillon.scene') } })
    const asked = vi.fn<DocumentNamer>(() => Promise.resolve(null))
    namedBy(asked)

    createDocumentIn('3d')

    await vi.waitFor(() => expect(asked).toHaveBeenCalled())
    expect(
      asked.mock.calls[0]?.[0].takenIn('documents').map(document => document.fileName),
    ).toEqual(expect.arrayContaining(['Niveau.scene', 'Brouillon.scene']))
  })

  // A name is taken in ONE folder: two folders may each hold a `Niveau.scene`, and the disk is
  // happy with both.
  it('answers what another folder holds, not what this one does', async () => {
    installFakeBridge({
      documents: { list: () => Promise.resolve([stored('Niveau', 'Niveau.scene')]) },
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
    expect(created()[0]?.path).toBe('Images/Croquis/Niveau.scene')
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
    expect(created()[0]?.title).toBe('Sans titre 1')
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
})
