import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { installFakeBridge } from '@/services/fake-bridge'
import { useDocuments } from '@/stores/documents'
import { useLayouts } from '@/stores/layouts'
import { useModels } from '@/stores/models'
import { useProject } from '@/stores/project'
import { DEFAULT_OPEN, useTools } from '@/stores/tools'
import { Rail } from './Rail'

const openDocument = vi.fn()
vi.mock('./dockview-api', () => ({ openDocument: (...args: unknown[]) => openDocument(...args) }))

describe('Rail', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    installFakeBridge()
    useDocuments.setState({ documents: {} })
    useLayouts.setState({ activeWorkspace: '3d', layouts: {} })
    useModels.setState({ selected: {} })
    const stamp = '2026-08-07T10:00:00.000Z'
    useProject.setState({
      project: {
        path: '/projects/one',
        manifest: { version: 1, name: 'One', createdAt: stamp, updatedAt: stamp },
      },
    })
  })

  it('creates a document in the active workspace and opens it', async () => {
    render(<Rail side="left" />)
    await userEvent.click(screen.getByRole('button', { name: 'Nouveau document' }))

    // The document is written before it is announced, so the tab arrives a turn later.
    await waitFor(() => expect(Object.keys(useDocuments.getState().documents)).toHaveLength(1))

    const documents = Object.values(useDocuments.getState().documents)
    expect(documents[0]?.workspace).toBe('3d')
    expect(openDocument).toHaveBeenCalledWith(documents[0])
  })

  // A document is a file in a project folder: with none open there is nowhere to write it, and
  // the click would fail after the fact rather than never being offered.
  it('disables the button while no project is open', () => {
    useProject.setState({ project: null })
    render(<Rail side="left" />)
    expect(screen.getByRole('button', { name: 'Nouveau document' })).toBeDisabled()
  })

  it('carries no new-document button on the right rail', () => {
    render(<Rail side="right" />)
    expect(screen.queryByRole('button', { name: 'Nouveau document' })).not.toBeInTheDocument()
  })

  // Generating without a model is impossible, so the icon is absent rather than dead: the rail
  // says what the section can do.
  it('offers no generator icon while no model is chosen', () => {
    useModels.setState({ selected: {} })
    render(<Rail side="left" />)
    expect(screen.queryByRole('button', { name: 'Génération' })).not.toBeInTheDocument()
  })

  it('offers it as soon as one is', () => {
    useModels.setState({ selected: { '3d': 'tripo-v3' } })
    render(<Rail side="left" />)
    expect(screen.getByRole('button', { name: 'Génération' })).toBeInTheDocument()
  })

  // The separator is decorative, hence hidden from assistive tech — it is read here as a
  // position in the rail, not as a control.
  function marksOf(container: HTMLElement): string[] {
    return [...container.querySelectorAll('button, span[aria-hidden="true"]')].map(
      node => node.getAttribute('aria-label') ?? 'separator',
    )
  }

  // The left rail is generation, under the button that makes a document, with the band's own
  // tools at its foot. The rail is the legend of the column, so it has to draw the same cut.
  it('puts generation on the left rail, under the new-document button', () => {
    useModels.setState({ selected: { '3d': 'tripo-v3' } })
    const { container } = render(<Rail side="left" />)

    expect(marksOf(container)).toEqual([
      'Nouveau document',
      'separator',
      'Modèles',
      'Génération',
      'Assets',
    ])
  })

  it('cuts the right rail where the column is cut: the document above, the selection below', () => {
    const { container } = render(<Rail side="right" />)

    expect(marksOf(container)).toEqual([
      'Explorateur',
      'Scène',
      'Lumières',
      'Mailles',
      'Apps',
      'separator',
      'Inspecteur',
    ])
  })

  // On the default layout no half names a panel, so the icon that reads as up is the first one
  // the section declares — the layers in Image, never the explorer under them.
  it('marks the section-first panel as up on the default layout', () => {
    useLayouts.setState({ activeWorkspace: 'image' })
    useTools.setState({ open: DEFAULT_OPEN })
    render(<Rail side="right" />)

    expect(screen.getByRole('button', { name: 'Calques' })).toHaveAttribute('aria-pressed', 'true')
    expect(screen.getByRole('button', { name: 'Explorateur' })).toHaveAttribute(
      'aria-pressed',
      'false',
    )
  })

  // The panel a section stands in for another is the one that is up, so its icon is the one
  // that reads as up — and a click on it closes the half instead of merely restating it.
  it('accents the icon of the panel the half actually shows', async () => {
    useLayouts.setState({ activeWorkspace: 'video' })
    useTools.setState({ open: { bottom: { primary: 'assets' } } })
    render(<Rail side="left" />)

    const montage = screen.getByRole('button', { name: 'Timeline' })
    expect(montage).toHaveAttribute('aria-pressed', 'true')

    await userEvent.click(montage)
    expect(useTools.getState().open.bottom?.primary).toBeUndefined()
  })
})
