import { kindForWorkspace } from '@shared/domain/document'
import { beforeEach, describe, expect, it } from 'vitest'
import { documentFolder } from '@/app/documentFolder'
import { useDocuments } from '@/stores/documents'

/**
 * Written here rather than taken from `document-fixtures.ts`: `installDocument` composes the path
 * itself, under `DOCUMENTS_FOLDER`, and what these cases are about is the path a document was READ
 * from — anywhere in the project, root included.
 */
function openAt(documentId: string, path: string): void {
  const kind = kindForWorkspace('skyboxes')
  if (!kind) throw new Error('the skyboxes workspace has no document kind')
  useDocuments.setState({
    documents: {
      [documentId]: { id: documentId, kind, title: documentId, workspace: 'skyboxes', path },
    },
    activeId: documentId,
  })
}

describe('the folder a document writes its links against', () => {
  beforeEach(() => {
    useDocuments.setState({ documents: {}, activeId: null })
  })

  it('names the segments of the folder holding the document', () => {
    openAt('doc', 'Repérages/Ciels/soir.gltf')

    expect(documentFolder('doc')).toEqual(['Repérages', 'Ciels'])
  })

  // The project root is not a segment: a link written from there must not gain a leading step.
  it('answers nothing for a document sitting at the root of the project', () => {
    openAt('doc', 'soir.gltf')

    expect(documentFolder('doc')).toEqual([])
  })

  /**
   * A document this window has not been shown — closed elsewhere, or not yet read — reads as the
   * root rather than throwing: every caller is a save or a load, and a link resolved against the
   * root is wrong where a reader can see it, when a crash loses the file instead.
   */
  it('answers the root for a document it holds nothing about', () => {
    expect(documentFolder('absent')).toEqual([])
  })
})
