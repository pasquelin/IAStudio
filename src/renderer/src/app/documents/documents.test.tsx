import { render, screen } from '@testing-library/react'
import type { IDockviewPanelProps } from 'dockview-react'
import { beforeEach, describe, expect, it } from 'vitest'
import type { DocumentKind } from '@shared/domain/document'
import { useDocuments } from '@/stores/documents'
import { DOCUMENT_COMPONENTS, type DocumentPanelParams } from './documents'

function renderPanel(kind: DocumentKind, documentId: string) {
  const Panel = DOCUMENT_COMPONENTS[kind]
  // The panel only reads `params`; the rest of Dockview's props are not exercised here.
  const props = { params: { documentId } } as IDockviewPanelProps<DocumentPanelParams>
  return render(<Panel {...props} />)
}

describe('document components', () => {
  beforeEach(() => {
    useDocuments.setState({ documents: {} })
  })

  it('renders a fallback rather than throwing when the document is gone', () => {
    renderPanel('scene', 'vanished')
    expect(screen.getByText('Ce document n’est plus ouvert.')).toBeInTheDocument()
  })
})
