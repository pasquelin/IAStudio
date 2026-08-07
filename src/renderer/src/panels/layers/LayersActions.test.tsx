import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it } from 'vitest'
import { addLayer } from '@/engines/canvas/commands'
import { installCanvas, layerFixture } from '@/stores/canvas-fixtures'
import { canvasOf, useCanvases } from '@/stores/canvases'
import { useDocuments } from '@/stores/documents'
import { LayersActions } from './LayersActions'

// Add and delete live on the tool window's own title bar, through the `Actions` slot.
describe('LayersActions', () => {
  beforeEach(() => {
    installCanvas('doc-1')
  })

  it('offers no layer action when no document is in front', () => {
    useDocuments.setState({ activeId: null })
    render(<LayersActions />)

    expect(screen.queryByRole('button', { name: /Ajouter/ })).not.toBeInTheDocument()
  })

  it('adds a layer', async () => {
    render(<LayersActions />)
    await userEvent.click(screen.getByRole('button', { name: 'Ajouter un calque' }))
    expect(canvasOf(useCanvases.getState(), 'doc-1').layers).toHaveLength(2)
  })

  it('refuses to delete the last remaining layer', () => {
    render(<LayersActions />)
    expect(screen.getByRole('button', { name: 'Supprimer le calque' })).toBeDisabled()
  })

  it('deletes the active layer once there are two', async () => {
    useCanvases.getState().runCommand('doc-1', addLayer(layerFixture()))
    render(<LayersActions />)

    await userEvent.click(screen.getByRole('button', { name: 'Supprimer le calque' }))
    expect(canvasOf(useCanvases.getState(), 'doc-1').layers).toHaveLength(1)
  })
})
