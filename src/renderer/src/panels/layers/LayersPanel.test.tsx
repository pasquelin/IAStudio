import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it } from 'vitest'
import { addLayer } from '@/engines/canvas/commands'
import { layerFixture } from '@/engines/canvas/canvas-fixtures'
import { groupLayer } from '@/engines/canvas/canvas-state'
import { installCanvas } from '@/stores/canvas-fixtures'
import { installDocument } from '@/stores/document-fixtures'
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
    installDocument('doc-1', '3d')
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

  describe('a row of the stack', () => {
    it('renames a layer on a double click', async () => {
      render(<LayersPanel />)
      await userEvent.dblClick(screen.getByText('Background'))
      await userEvent.clear(screen.getByRole('textbox'))
      await userEvent.type(screen.getByRole('textbox'), 'Sky{Enter}')

      expect(canvasOf(useCanvases.getState(), 'doc-1').layers[0]?.name).toBe('Sky')
    })

    // Clicking away from a half-typed name is how most renames end.
    it('keeps what was typed when the field loses focus', async () => {
      render(<LayersPanel />)
      await userEvent.dblClick(screen.getByText('Background'))
      await userEvent.clear(screen.getByRole('textbox'))
      await userEvent.type(screen.getByRole('textbox'), 'Sky')
      await userEvent.tab()

      expect(canvasOf(useCanvases.getState(), 'doc-1').layers[0]?.name).toBe('Sky')
    })

    it('leaves the name alone when the rename is abandoned', async () => {
      render(<LayersPanel />)
      await userEvent.dblClick(screen.getByText('Background'))
      await userEvent.type(screen.getByRole('textbox'), 'Sky{Escape}')

      expect(canvasOf(useCanvases.getState(), 'doc-1').layers[0]?.name).toBe('Background')
    })

    // One button rather than three on the line: a row is 24 px tall in compact.
    it('opens the three padlocks behind a single button', async () => {
      render(<LayersPanel />)
      await userEvent.click(screen.getByRole('button', { name: /^Verrous/ }))

      await userEvent.click(
        await screen.findByRole('menuitem', { name: 'Verrouiller la position' }),
      )

      expect(canvasOf(useCanvases.getState(), 'doc-1').layers[0]?.locked).toEqual({
        pixels: false,
        position: true,
        alpha: false,
      })
    })

    it('nests the children of a group and folds them away on the chevron', async () => {
      useCanvases
        .getState()
        .runCommand(
          'doc-1',
          addLayer(groupLayer('g', 'Group', [layerFixture({ id: 'inside', name: 'Inside' })])),
        )
      render(<LayersPanel />)
      expect(screen.getByText('Inside')).toBeInTheDocument()

      await userEvent.click(screen.getByRole('button', { name: /^Replier/ }))

      expect(screen.queryByText('Inside')).not.toBeInTheDocument()
    })

    // Folding a group is a way of looking at the stack, not an edit of it.
    it('does not put a fold in the history', async () => {
      useCanvases.getState().runCommand('doc-1', addLayer(groupLayer('g', 'Group', [])))
      render(<LayersPanel />)
      await userEvent.click(screen.getByRole('button', { name: /^Replier/ }))

      useCanvases.getState().undo('doc-1')

      expect(canvasOf(useCanvases.getState(), 'doc-1').layers).toHaveLength(1)
    })
  })
})
