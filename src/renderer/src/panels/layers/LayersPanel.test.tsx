import { render, screen, waitFor, within } from '@testing-library/react'
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

    // The field is torn out on commit, and a torn-out input leaves focus on `document.body`:
    // the next Tab restarts from the top of the window, so whoever just renamed at the keyboard
    // is thrown out of the list they were editing.
    it('gives the focus back to the row rather than dropping it on the document', async () => {
      render(<LayersPanel />)
      await userEvent.dblClick(screen.getByText('Background'))
      await userEvent.clear(screen.getByRole('textbox'))
      await userEvent.type(screen.getByRole('textbox'), 'Sky{Enter}')

      await waitFor(() => expect(screen.queryByRole('textbox')).not.toBeInTheDocument())
      expect(screen.getByText('Sky').closest('[role="option"]')).toHaveFocus()
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

      await userEvent.click(await screen.findByRole('menuitem', { name: 'Position' }))

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

  /**
   * Both lists are virtualized and re-key their rows on every change, so a layer added while a
   * name is being typed tears the field out of the tree — and React fires no blur for an input
   * it unmounts. The name was lost with it.
   */
  it('keeps a name typed in a row that is torn out from under it', async () => {
    render(<LayersPanel />)
    await userEvent.dblClick(screen.getByText('Background'))
    await userEvent.clear(screen.getByRole('textbox'))
    await userEvent.type(screen.getByRole('textbox'), 'Sky')

    // What a finished generation does while the field is open.
    useCanvases.getState().runCommand('doc-1', addLayer(layerFixture()))

    await waitFor(() =>
      expect(canvasOf(useCanvases.getState(), 'doc-1').layers[0]?.name).toBe('Sky'),
    )
  })

  /**
   * The same tear-out, judged on the focus rather than on the name. The row the edit started on
   * is gone — remounted at another index under another key — so there is nothing to give the
   * focus back to. Landing on `document.body` would throw the keyboard out of the panel, which
   * is the whole defect; the stack's own tab stop keeps it inside.
   */
  it('keeps the keyboard in the stack when the row is torn out from under it', async () => {
    render(<LayersPanel />)
    await userEvent.dblClick(screen.getByText('Background'))
    await userEvent.clear(screen.getByRole('textbox'))
    await userEvent.type(screen.getByRole('textbox'), 'Sky')

    useCanvases.getState().runCommand('doc-1', addLayer(layerFixture()))

    await waitFor(() => expect(screen.queryByRole('textbox')).not.toBeInTheDocument())
    expect(document.activeElement).not.toBe(document.body)
    expect(screen.getByRole('listbox', { name: 'Calques' })).toContainElement(
      // `as`: `activeElement` is typed as `Element`, and `toContainElement` wants an `HTMLElement`.
      document.activeElement as HTMLElement,
    )
  })
})
