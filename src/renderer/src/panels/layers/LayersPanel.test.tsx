import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it } from 'vitest'
import { addLayer } from '@/engines/canvas/commands'
import { installCanvas, layerFixture } from '@/stores/canvas-fixtures'
import { canvasOf, useCanvases } from '@/stores/canvases'
import { useDocuments } from '@/stores/documents'
import { LayersPanel } from './LayersPanel'

describe('LayersPanel', () => {
  // The panel sits on the edge, outside Dockview: it reads the image in front rather than being
  // handed one.
  beforeEach(() => {
    installCanvas('doc-1')
  })

  it('says so when no document is in front, rather than showing an empty stack', () => {
    useDocuments.setState({ activeId: null })
    render(<LayersPanel />)

    expect(screen.getByText('Ouvrez une image pour voir ses calques.')).toBeInTheDocument()
  })

  // A scene handed to `useCanvases` would grow a stack of its own, drawn from the default state.
  it('shows no stack for a document that is not an image', () => {
    useDocuments.setState({
      documents: { 'doc-1': { id: 'doc-1', kind: 'scene', workspace: '3d', title: 'doc-1' } },
    })
    render(<LayersPanel />)

    expect(screen.getByText('Ouvrez une image pour voir ses calques.')).toBeInTheDocument()
  })

  it('lists the stack top first, the way every editor shows it', () => {
    useCanvases.getState().runCommand('doc-1', addLayer(layerFixture()))
    render(<LayersPanel />)

    const rows = screen.getAllByRole('option')
    expect(within(rows[0] as HTMLElement).getByText('Paint')).toBeInTheDocument()
  })

  it('activates the layer whose row is clicked', async () => {
    useCanvases.getState().runCommand('doc-1', addLayer(layerFixture()))
    render(<LayersPanel />)

    await userEvent.click(screen.getByText('Background'))
    expect(canvasOf(useCanvases.getState(), 'doc-1').activeLayerId).toBe('layer-1')
  })

  // The stack goes through `Collection` precisely so it answers the keyboard like every other
  // list of the studio, rather than being the one that only takes a click.
  it('activates the focused layer on Enter', async () => {
    useCanvases.getState().runCommand('doc-1', addLayer(layerFixture()))
    render(<LayersPanel />)

    const rows = screen.getAllByRole('option')
    ;(rows[1] as HTMLElement).focus()
    await userEvent.keyboard('{Enter}')

    expect(canvasOf(useCanvases.getState(), 'doc-1').activeLayerId).toBe('layer-1')
  })

  it('toggles visibility without selecting the row', async () => {
    useCanvases.getState().runCommand('doc-1', addLayer(layerFixture()))
    render(<LayersPanel />)

    const rows = screen.getAllByRole('option')
    const eye = within(rows[1] as HTMLElement).getByRole('button', { name: 'Afficher ou masquer' })
    await userEvent.click(eye)

    const canvas = canvasOf(useCanvases.getState(), 'doc-1')
    expect(canvas.layers[0]?.visible).toBe(false)
    // Clicking the eye of another row must not steal the selection.
    expect(canvas.activeLayerId).toBe('layer-2')
  })
})
