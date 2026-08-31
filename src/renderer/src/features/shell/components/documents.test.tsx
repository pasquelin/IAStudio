import { fireEvent, render, screen } from '@testing-library/react'
import type { IDockviewPanelProps } from 'dockview-react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { DocumentKind } from '@shared/domain/document'
import { useDocuments } from '@/stores/documents'
import { DOCUMENT_COMPONENTS, type DocumentPanelParams } from './documents'

function renderPanel(
  kind: DocumentKind,
  documentId: string,
  api: Partial<IDockviewPanelProps<DocumentPanelParams>['api']> = {},
) {
  const Panel = DOCUMENT_COMPONENTS[kind]
  // The panel reads `params` and the two members of `api` below; the rest of Dockview's props are
  // not exercised here.
  const props = { params: { documentId }, api } as IDockviewPanelProps<DocumentPanelParams>
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

  /**
   * The section follows the tab in FRONT (`DocumentArea.followFront`), and Dockview brings a group
   * forward off FOCUS alone — which a click on a viewport never gives, a `div` not being focusable.
   * So working inside a texture while the 3D docks were up left the whole periphery answering for
   * the other document.
   */
  it('brings its panel forward when the pointer lands anywhere in the document', () => {
    const setActive = vi.fn()
    const { container } = renderPanel('scene', 'vanished', { isActive: false, setActive })

    fireEvent.pointerDown(screen.getByText('Ce document n’est plus ouvert.'))

    expect(setActive).toHaveBeenCalled()
    expect(container.firstElementChild).not.toBeNull()
  })

  // Dockview reads the same press for its own reasons; asking again on every click is noise.
  it('says nothing where its panel is already the one in front', () => {
    const setActive = vi.fn()
    renderPanel('scene', 'vanished', { isActive: true, setActive })

    fireEvent.pointerDown(screen.getByText('Ce document n’est plus ouvert.'))

    expect(setActive).not.toHaveBeenCalled()
  })
})
