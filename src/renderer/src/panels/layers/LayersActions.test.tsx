import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it } from 'vitest'
import { addLayer } from '@/engines/canvas/commands'
import { layerFixture } from '@/engines/canvas/canvas-fixtures'
import { groupLayer } from '@/engines/canvas/canvas-state'
import { installCanvas } from '@/stores/canvas-fixtures'
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

  describe('the stack operations', () => {
    /** Opens the operations menu and chooses one by its label. */
    async function choose(label: RegExp | string): Promise<void> {
      await userEvent.click(screen.getByRole('button', { name: /^Opérations/ }))
      await userEvent.click(await screen.findByRole('menuitem', { name: label }))
    }

    const stack = () => canvasOf(useCanvases.getState(), 'doc-1')

    it('wraps the armed layer in a group', async () => {
      render(<LayersActions />)
      await choose('Grouper')

      expect(stack().layers[0]?.kind).toBe('group')
    })

    it('dissolves a group, leaving its children where it stood', async () => {
      useCanvases
        .getState()
        .runCommand('doc-1', addLayer(groupLayer('g', 'Group', [layerFixture({ id: 'inside' })])))
      render(<LayersActions />)
      await choose('Dégrouper')

      expect(stack().layers.map(layer => layer.id)).toEqual(['layer-1', 'inside'])
    })

    // A group holds no pixels, so `paintTarget` refuses it: arming one leaves the brush drawing
    // nothing at all, silently — the state `deserializeCanvas` refuses to even load.
    it('arms the layer it wrapped rather than the group it made', async () => {
      render(<LayersActions />)
      await choose('Grouper')

      expect(stack().activeLayerId).toBe('layer-1')
    })

    it('copies the armed layer, with an id of its own', async () => {
      render(<LayersActions />)
      await choose('Dupliquer')

      expect(stack().layers).toHaveLength(2)
      expect(new Set(stack().layers.map(layer => layer.id)).size).toBe(2)
    })

    /**
     * Merging and flattening are not offered: both restructure the stack, and nothing in
     * `CanvasEngine` composites the pixels of the layers they remove — the textures are simply
     * destroyed, and the reborn layer is transparent. A row that empties the document is worse
     * than a row that is not there.
     */
    it('offers neither merge nor flatten, which would throw the pixels away', async () => {
      render(<LayersActions />)
      await userEvent.click(screen.getByRole('button', { name: /^Opérations/ }))

      const rows = await screen.findAllByRole('menuitem')
      expect(rows.map(row => row.textContent)).toEqual(['Grouper', 'Dégrouper', 'Dupliquer'])
    })
  })
})
