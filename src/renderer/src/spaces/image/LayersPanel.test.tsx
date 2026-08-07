import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it } from 'vitest'
import { addLayer } from '@/engines/canvas/commands'
import type { Layer } from '@/engines/canvas/canvas-state'
import { canvasOf, useCanvases } from '@/stores/canvases'
import { LayersPanel } from './LayersPanel'

const second: Layer = {
  id: 'layer-2',
  name: 'Paint',
  visible: true,
  locked: false,
  opacity: 1,
  blend: 'normal',
}

describe('LayersPanel', () => {
  beforeEach(() => {
    useCanvases.setState({ canvases: {}, histories: {} })
  })

  it('lists the stack top first, the way every editor shows it', () => {
    useCanvases.getState().runCommand('doc-1', addLayer({ ...second }))
    render(<LayersPanel documentId="doc-1" />)

    const rows = screen.getAllByRole('listitem')
    expect(within(rows[0] as HTMLElement).getByText('Paint')).toBeInTheDocument()
  })

  it('adds a layer', async () => {
    render(<LayersPanel documentId="doc-1" />)
    await userEvent.click(screen.getByRole('button', { name: 'Ajouter un calque' }))
    expect(canvasOf(useCanvases.getState(), 'doc-1').layers).toHaveLength(2)
  })

  it('activates the layer whose row is clicked', async () => {
    useCanvases.getState().runCommand('doc-1', addLayer({ ...second }))
    render(<LayersPanel documentId="doc-1" />)

    await userEvent.click(screen.getByText('Background'))
    expect(canvasOf(useCanvases.getState(), 'doc-1').activeLayerId).toBe('layer-1')
  })

  it('toggles visibility without selecting the row', async () => {
    useCanvases.getState().runCommand('doc-1', addLayer({ ...second }))
    render(<LayersPanel documentId="doc-1" />)

    const rows = screen.getAllByRole('listitem')
    const eye = within(rows[1] as HTMLElement).getByRole('button', { name: 'Afficher ou masquer' })
    await userEvent.click(eye)

    const canvas = canvasOf(useCanvases.getState(), 'doc-1')
    expect(canvas.layers[0]?.visible).toBe(false)
    // Clicking the eye of another row must not steal the selection.
    expect(canvas.activeLayerId).toBe('layer-2')
  })

  it('refuses to delete the last remaining layer', () => {
    render(<LayersPanel documentId="doc-1" />)
    expect(screen.getByRole('button', { name: 'Supprimer le calque' })).toBeDisabled()
  })

  it('deletes the active layer once there are two', async () => {
    useCanvases.getState().runCommand('doc-1', addLayer({ ...second }))
    render(<LayersPanel documentId="doc-1" />)

    await userEvent.click(screen.getByRole('button', { name: 'Supprimer le calque' }))
    expect(canvasOf(useCanvases.getState(), 'doc-1').layers).toHaveLength(1)
  })
})
