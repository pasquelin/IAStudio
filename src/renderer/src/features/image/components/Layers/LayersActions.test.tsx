import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { addLayer } from '@/engines/canvas/commands'
import { layerFixture } from '@/engines/canvas/canvas-fixtures'
import { NEUTRAL_ADJUSTMENTS } from '@shared/domain/adjustments'
import { groupLayer } from '@/engines/canvas/canvasState'
import { subscribeToCommands } from '@/services/commandBus'
import { installCanvas } from '@/stores/canvas-fixtures'
import { canvasOf, useCanvases } from '@/stores/canvases'
import { useCanvasViews } from '@/stores/canvasViews'
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
      expect(rows.map(row => row.textContent)).toEqual([
        'Grouper',
        'Dégrouper',
        'Dupliquer',
        'Faire un masque de la sélection',
      ])
    })

    /**
     * Published rather than run — carving the mask is the engine's, and this panel holds none.
     * Addressed to the document it SHOWS: pinned to a background image, the row would otherwise
     * engrave whichever image happened to be in front.
     */
    it('asks the document it shows to make a mask, rather than reaching for its engine', async () => {
      useCanvasViews
        .getState()
        .setSelection('doc-1', { kind: 'rect', rect: { x: 0, y: 0, width: 4, height: 4 } })
      const heard = vi.fn()
      const stop = subscribeToCommands(heard)
      render(<LayersActions />)

      await userEvent.click(screen.getByRole('button', { name: /^Opérations/ }))
      await userEvent.click(await screen.findByRole('menuitem', { name: /masque/ }))

      expect(heard).toHaveBeenCalledWith('canvas.maskFromSelection', 'doc-1')
      stop()
    })

    /** Nothing to make a mask OF: the row is offered greyed rather than doing nothing. */
    it('greys that row while nothing is selected', async () => {
      useCanvasViews.getState().setSelection('doc-1', null)
      render(<LayersActions />)

      await userEvent.click(screen.getByRole('button', { name: /^Opérations/ }))

      expect(await screen.findByRole('menuitem', { name: /masque/ })).toBeDisabled()
    })

    // The label is composed from the operation key, and so is the sentence: neither is written
    // beside the row, and both go missing the same silent way.
    it('explains each operation rather than reading its label back', async () => {
      render(<LayersActions />)
      await userEvent.click(screen.getByRole('button', { name: /^Opérations/ }))

      const rows = await screen.findAllByRole('menuitem')
      expect(rows.map(row => row.getAttribute('data-tooltip-content'))).toEqual([
        'Range le calque actif dans un nouveau groupe',
        'Sort les calques du groupe et supprime le groupe',
        'Copie le calque actif juste au-dessus de lui',
        'Masque le calque actif hors de la région sélectionnée.',
      ])
      // An `aria-label` over a visible label replaces it for a screen reader (WCAG 2.5.3).
      for (const row of rows) expect(row).not.toHaveAttribute('aria-label')
    })
  })

  describe('adjustment layers', () => {
    const stack = () => canvasOf(useCanvases.getState(), 'doc-1')

    it('lays an adjustment over what is below it', async () => {
      render(<LayersActions />)
      await userEvent.click(screen.getByRole('button', { name: /^Ajouter un réglage/ }))
      await userEvent.click(await screen.findByRole('menuitem', { name: 'Exposition' }))

      expect(stack().layers.at(-1)).toMatchObject({ kind: 'adjustment', adjustment: 'exposure' })
    })

    // Four dials, and only four: these are the ones the grading pass actually applies.
    it('offers exactly the adjustments the pass can apply', async () => {
      render(<LayersActions />)
      await userEvent.click(screen.getByRole('button', { name: /^Ajouter un réglage/ }))

      const rows = await screen.findAllByRole('menuitem')
      expect(rows.map(row => row.textContent)).toEqual([
        'Exposition',
        'Contraste',
        'Saturation',
        'Température',
      ])
    })

    it('says what each dial does, which four nouns cannot', async () => {
      render(<LayersActions />)
      await userEvent.click(screen.getByRole('button', { name: /^Ajouter un réglage/ }))

      const rows = await screen.findAllByRole('menuitem')
      expect(rows.map(row => row.getAttribute('data-tooltip-content'))).toEqual([
        'Éclaircit ou assombrit tout ce qui est en dessous',
        'Écarte les tons clairs des tons sombres, ou les rapproche',
        'Ravive les couleurs ou les éteint, jusqu’au gris',
        'Réchauffe vers l’orange ou refroidit vers le bleu',
      ])
    })

    // A new adjustment changes nothing until a dial is moved.
    it('is born neutral', async () => {
      render(<LayersActions />)
      await userEvent.click(screen.getByRole('button', { name: /^Ajouter un réglage/ }))
      await userEvent.click(await screen.findByRole('menuitem', { name: 'Contraste' }))

      const layer = stack().layers.at(-1)
      expect(layer?.kind === 'adjustment' && layer.values).toEqual(NEUTRAL_ADJUSTMENTS)
    })
  })
})
