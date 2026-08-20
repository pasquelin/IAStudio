import { render, screen } from '@testing-library/react'
import type { IDockviewPanelProps } from 'dockview-react'
import { beforeEach, describe, expect, it } from 'vitest'
import { useDocuments } from '@/stores/documents'
import { DOCUMENT_COMPONENTS, type DocumentPanelParams } from './documents'

function renderPanel(component: string, documentId: string) {
  const Panel = DOCUMENT_COMPONENTS[component]
  if (!Panel) throw new Error(`no component registered for ${component}`)
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

  it('registers a component for every document kind', () => {
    expect(DOCUMENT_COMPONENTS.image).toBeDefined()
    expect(DOCUMENT_COMPONENTS.scene).toBeDefined()
  })
})
