import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { DocumentDescriptor } from '@shared/domain/document'
import { installFakeBridge } from '@/services/fake-bridge'
import { useDocuments } from '@/stores/documents'
import { useProject } from '@/stores/project'
import { registerDocumentNamer, type DocumentNamer } from './document-name'
import { createDocumentIn } from './new-document'

const openDocument = vi.fn()
vi.mock('./dockview-api', () => ({ openDocument: (...args: unknown[]) => openDocument(...args) }))

const stored = (title: string, fileName: string): DocumentDescriptor => ({
  id: fileName,
  kind: 'scene',
  workspace: '3d',
  title,
  fileName,
})

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
    namedBy(() => Promise.resolve('Niveau'))

    createDocumentIn('3d')

    await vi.waitFor(() => expect(created()).toHaveLength(1))
    expect(created()[0]?.title).toBe('Niveau')
    // The name is the file name: there is only ever one name to change afterwards.
    expect(created()[0]?.fileName).toBe('Niveau.scene')
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
    expect(asked.mock.calls[0]?.[0].taken.map(document => document.fileName)).toEqual(
      expect.arrayContaining(['Niveau.scene', 'Brouillon.scene']),
    )
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
    const asked = vi.fn<DocumentNamer>(() => Promise.resolve('Niveau'))
    namedBy(asked)

    createDocumentIn('3d')
    // Long enough for the listing and the question that would have followed it.
    await new Promise(settled => setTimeout(settled, 0))

    expect(asked).not.toHaveBeenCalled()
    expect(created()).toHaveLength(0)
  })
})
