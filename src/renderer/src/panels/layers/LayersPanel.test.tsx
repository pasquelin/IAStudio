import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it } from 'vitest'
import { NO_BREAK_SPACE } from '@shared/i18n/typography'
import { addLayer, groupLayers } from '@/engines/canvas/commands'
import { layerFixture } from '@/engines/canvas/canvas-fixtures'
import { groupLayer, isGroup } from '@/engines/canvas/canvas-state'
import { dragTransfer } from '@/helpers/drag-fixtures'
import { installCanvas } from '@/stores/canvas-fixtures'
import { installDocument } from '@/stores/document-fixtures'
import { canvasOf, useCanvases } from '@/stores/canvases'
import { useDocuments } from '@/stores/documents'
import { LayersPanel } from './LayersPanel'

/**
 * The chevron belongs to `Tree`, which owns the geometry of every stack in the studio: it is
 * `aria-hidden` on purpose — the row already carries `aria-expanded`, and the arrow keys already
 * fold it — so it is reached the way the tree's own suite reaches it, by the handle it publishes.
 */
const chevronOf = (name: string): HTMLElement =>
  screen
    .getByText(name)
    .closest('[role="treeitem"]')
    ?.querySelector('[data-chevron]') as HTMLElement

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

    const rows = screen.getAllByRole('treeitem')
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

    const rows = screen.getAllByRole('treeitem')
    ;(rows[1] as HTMLElement).focus()
    await userEvent.keyboard('{Enter}')

    expect(canvasOf(useCanvases.getState(), 'doc-1').activeLayerId).toBe('layer-1')
  })

  it('toggles visibility without selecting the row', async () => {
    useCanvases.getState().runCommand('doc-1', addLayer(layerFixture()))
    render(<LayersPanel />)

    const rows = screen.getAllByRole('treeitem')
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
      expect(screen.getByText('Sky').closest('[role="treeitem"]')).toHaveFocus()
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

      await userEvent.click(await screen.findByRole('menuitemcheckbox', { name: 'Position' }))

      expect(canvasOf(useCanvases.getState(), 'doc-1').layers[0]?.locked).toEqual({
        pixels: false,
        position: true,
        alpha: false,
      })
    })

    // Three nouns that say what is locked and never what locking it costs — the padlock on the
    // alpha is the one nobody guesses.
    it('says what each padlock forbids', async () => {
      render(<LayersPanel />)
      await userEvent.click(screen.getByRole('button', { name: /^Verrous/ }))

      const rows = await screen.findAllByRole('menuitemcheckbox')
      expect(rows.map(row => row.getAttribute('data-tooltip-content'))).toEqual([
        'Empêche de peindre sur ce calque, sans le figer sur place',
        `Empêche de déplacer le calque${NO_BREAK_SPACE}; on peut encore y peindre`,
        'Ne peint que là où le calque a déjà de la matière',
      ])
      // An `aria-label` over a visible label replaces it for a screen reader (WCAG 2.5.3).
      for (const row of rows) expect(row).not.toHaveAttribute('aria-label')
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

      await userEvent.click(chevronOf('Group'))

      expect(screen.queryByText('Inside')).not.toBeInTheDocument()
    })

    // Folding a group is a way of looking at the stack, not an edit of it.
    it('does not put a fold in the history', async () => {
      useCanvases.getState().runCommand('doc-1', addLayer(groupLayer('g', 'Group', [])))
      render(<LayersPanel />)
      await userEvent.click(chevronOf('Group'))

      useCanvases.getState().undo('doc-1')

      expect(canvasOf(useCanvases.getState(), 'doc-1').layers).toHaveLength(1)
    })
  })

  describe('deleting from the row itself', () => {
    const trashOf = (name: string): HTMLElement =>
      within(screen.getByText(name).closest('[role="treeitem"]') as HTMLElement).getByRole(
        'button',
        { name: /^Supprimer/ },
      )

    /**
     * `Tree` arms a row on POINTER DOWN, which fires before the click. A delete that only stopped
     * the click armed the row it was about to remove — and `withoutLayer` then handed the brush
     * to that row's neighbour, so the next stroke landed on a layer nobody chose.
     */
    it('leaves the armed layer alone when another row is deleted', async () => {
      // Three, and the armed one furthest from the deleted row: with two, the neighbour
      // `withoutLayer` falls back to happens to BE the armed layer, and the case passes without
      // the guard it exists for.
      useCanvases.getState().runCommand('doc-1', addLayer(layerFixture({ id: 'layer-2' })))
      useCanvases
        .getState()
        .runCommand('doc-1', addLayer(layerFixture({ id: 'layer-3', name: 'Top' })))
      render(<LayersPanel />)
      expect(canvasOf(useCanvases.getState(), 'doc-1').activeLayerId).toBe('layer-3')

      await userEvent.click(trashOf('Background'))

      const canvas = canvasOf(useCanvases.getState(), 'doc-1')
      expect(canvas.layers.map(layer => layer.name)).toEqual(['Paint', 'Top'])
      expect(canvas.activeLayerId).toBe('layer-3')
    })

    /**
     * `removeLayer` waives its last-layer guard for a group, so the count of paintable layers is
     * not what decides here: a folder holding every pixel layer of the document empties the stack
     * on its own, and `deserializeCanvas` reads an empty stack back as a blank default — losing
     * the size and the colour mode of the picture.
     */
    it('refuses to delete a group holding everything the document can paint on', () => {
      useCanvases.getState().runCommand('doc-1', groupLayers(['layer-1'], 'g', 'Group'))
      render(<LayersPanel />)

      expect(trashOf('Group')).toBeDisabled()
    })

    it('offers to delete a group the stack can do without', () => {
      useCanvases.getState().runCommand('doc-1', addLayer(layerFixture()))
      useCanvases.getState().runCommand('doc-1', groupLayers(['layer-1'], 'g', 'Group'))
      render(<LayersPanel />)

      expect(trashOf('Group')).toBeEnabled()
    })
  })

  /**
   * The list runs top first and the stack bottom first, so a drag that read the index straight
   * across would send the layer to the far end of its level. These two are what say the
   * reversal is applied, and applied once.
   */
  describe('reordering by dragging a row', () => {
    // jsdom measures every element at zero, and where the pointer sits in the row is the whole
    // difference between an insertion and a drop into a group.
    const dropAt = (row: HTMLElement, ratio: number, data: DataTransfer): void => {
      // `as DOMRect`: the handler reads `top` and `height`, and the ten other fields of a
      // rectangle would say nothing about the drop.
      row.getBoundingClientRect = () => ({ top: 0, height: 30 }) as DOMRect
      fireEvent.drop(row, { dataTransfer: data, clientY: 30 * ratio })
    }

    const stackOf = (): (string | undefined)[] =>
      canvasOf(useCanvases.getState(), 'doc-1').layers.map(layer => layer.name)

    it('puts the row dropped at the top of the list on top of the stack', () => {
      useCanvases.getState().runCommand('doc-1', addLayer(layerFixture()))
      render(<LayersPanel />)

      // Listed top first: Paint, then Background.
      const [paint, background] = screen.getAllByRole('treeitem')
      const data = dragTransfer()
      fireEvent.dragStart(background!, { dataTransfer: data })
      dropAt(paint!, 0.1, data)

      // Drawn bottom first, so the top of the stack is the end of the array.
      expect(stackOf()).toEqual(['Paint', 'Background'])
    })

    /**
     * A folded group hides what it holds, so a layer dropped into one left the panel entirely:
     * no row anywhere, while the inspector went on describing it.
     */
    it('unfolds the group it drops a layer into', () => {
      useCanvases.getState().runCommand(
        'doc-1',
        addLayer({
          ...groupLayer('g', 'Group', [layerFixture({ id: 'inside', name: 'Inside' })]),
          collapsed: true,
        }),
      )
      render(<LayersPanel />)
      expect(screen.queryByText('Inside')).not.toBeInTheDocument()

      const [group, background] = screen.getAllByRole('treeitem')
      const data = dragTransfer()
      fireEvent.dragStart(background!, { dataTransfer: data })
      dropAt(group!, 0.5, data)

      expect(screen.getByText('Background')).toBeInTheDocument()
      expect(screen.getByText('Inside')).toBeInTheDocument()
    })

    // A stack rebuilt into the same stack still takes a place in the history, and the ⌘Z that
    // follows appears to do nothing.
    it('writes nothing to the history when the layer is dropped where it already sits', () => {
      useCanvases
        .getState()
        .runCommand('doc-1', addLayer(groupLayer('g', 'Group', [layerFixture({ id: 'inside' })])))
      render(<LayersPanel />)

      // 'Paint' is already the topmost — the only — child of the group.
      const [group, paint] = screen.getAllByRole('treeitem')
      const data = dragTransfer()
      fireEvent.dragStart(paint!, { dataTransfer: data })
      dropAt(group!, 0.5, data)

      // The one ⌘Z undoes the group that was added, because the drop wrote nothing of its own.
      useCanvases.getState().undo('doc-1')
      expect(stackOf()).toEqual(['Background'])
    })

    it('takes a layer into the group it is dropped onto', () => {
      useCanvases
        .getState()
        .runCommand('doc-1', addLayer(groupLayer('g', 'Group', [layerFixture({ id: 'inside' })])))
      render(<LayersPanel />)

      const [group, , background] = screen.getAllByRole('treeitem')
      const data = dragTransfer()
      fireEvent.dragStart(background!, { dataTransfer: data })
      dropAt(group!, 0.5, data)

      expect(stackOf()).toEqual(['Group'])
      const held = canvasOf(useCanvases.getState(), 'doc-1').layers[0]
      expect(held && isGroup(held) ? held.children.map(child => child.name) : []).toEqual([
        'Paint',
        'Background',
      ])
    })
  })

  /**
   * A layer arriving while a name is being typed — what a finished generation does — used to
   * tear the field out and lose what was in it: the list keyed its rows on the virtualizer's
   * INDEX, so every row below the new one was reused for another layer.
   *
   * `Tree` keys on the layer's id, so the row being edited stays the row being edited wherever
   * it slides to. The name is not rescued after the fact any more; it is never interrupted.
   */
  it('keeps the rename open when a layer arrives above the row being edited', async () => {
    render(<LayersPanel />)
    await userEvent.dblClick(screen.getByText('Background'))
    await userEvent.clear(screen.getByRole('textbox'))
    await userEvent.type(screen.getByRole('textbox'), 'Sky')

    useCanvases.getState().runCommand('doc-1', addLayer(layerFixture()))

    await waitFor(() => expect(screen.getByRole('textbox')).toHaveValue('Sky'))
    expect(screen.getByRole('textbox')).toHaveFocus()

    await userEvent.keyboard('{Enter}')
    expect(canvasOf(useCanvases.getState(), 'doc-1').layers[0]?.name).toBe('Sky')
  })
})
