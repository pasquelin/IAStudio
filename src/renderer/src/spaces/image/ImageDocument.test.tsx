import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { Asset } from '@shared/domain/asset'
import { ASSET_DRAG_TYPE, startAssetDrag } from '@/helpers/asset-drag'
import { dragTransfer } from '@/helpers/drag-fixtures'
import { useAssets } from '@/stores/assets'
import { canvasOf, useCanvases } from '@/stores/canvases'
import { useDocuments } from '@/stores/documents'
import { bridgeWatchingLogs } from '@/services/fake-bridge'
import { useTools } from '@/stores/tools'
import { ImageDocument } from './ImageDocument'

const setTool = vi.fn()
const setBrush = vi.fn()
const applyCrop = vi.fn()
const dropCrop = vi.fn()

// jsdom has no WebGL context: the engine is exercised by hand, not here. What this covers is
// that the document wires the bar to the right calls.
vi.mock('@/engines/canvas/CanvasEngine', () => {
  return {
    // Repeated rather than imported from the real module: importing it would pull Pixi into a
    // jsdom run that has no WebGL context.
    DEFAULT_BRUSH: { size: 24, hardness: 0.8, opacity: 1, color: 0x000000 },
    CanvasEngine: class {
      mount = vi.fn(() => Promise.resolve())
      apply = vi.fn()
      dispose = vi.fn()
      setView = vi.fn()
      setTool = setTool
      setBrush = setBrush
      loadInto = vi.fn(() => Promise.resolve())
      setSelection = vi.fn()
      setSelectionShape = vi.fn()
      snapshot = vi.fn(() => Promise.resolve('data:image/png;base64,AAAA'))
      applyCrop = applyCrop
      dropCrop = dropCrop
      pixelSnapshots = vi.fn(() => Promise.resolve([]))
      restoreSnapshot = vi.fn(() => Promise.resolve())
    },
  }
})

describe('ImageDocument', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    useCanvases.setState({ states: {}, histories: {} })
  })

  it('renders the shared toolbar with the image tools', () => {
    render(<ImageDocument documentId="doc-1" />)
    // A group wears its armed mode's name, so the pointer reads `Move` and the paint group
    // `Brush` — the bar says what the next click will do, not what the group is called.
    expect(screen.getByRole('button', { name: /^Déplacement/ })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /^Pinceau/ })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /^Rectangle/ })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /^Texte/ })).toBeInTheDocument()
  })

  it('opens on the pointer, so the first click cannot write on the picture', () => {
    render(<ImageDocument documentId="doc-1" />)

    expect(screen.getByRole('button', { name: /^Déplacement/ })).toHaveAttribute(
      'aria-pressed',
      'true',
    )
    expect(screen.getByRole('button', { name: /^Pinceau/ })).toHaveAttribute(
      'aria-pressed',
      'false',
    )
  })

  it('offers every shape Figma does, behind the shapes group', async () => {
    render(<ImageDocument documentId="doc-1" />)
    await userEvent.hover(screen.getByRole('button', { name: /^Rectangle/ }))

    // The accessible name carries the shortcut, so `Line` reads `Line (L)`.
    for (const name of ['Trait', 'Flèche', 'Ellipse', 'Polygone', 'Étoile']) {
      expect(await screen.findByRole('menuitem', { name: new RegExp(`^${name}`) })).toBeVisible()
    }
  })

  it('arms the group with the mode chosen, and hands it to the engine', async () => {
    render(<ImageDocument documentId="doc-1" />)

    await userEvent.hover(screen.getByRole('button', { name: /^Déplacement/ }))
    await userEvent.click(await screen.findByRole('menuitem', { name: /^Main/ }))

    expect(setTool).toHaveBeenLastCalledWith('hand')
    expect(screen.getByRole('button', { name: /^Main/ })).toBeInTheDocument()
  })

  it('offers a colour input', () => {
    render(<ImageDocument documentId="doc-1" />)
    expect(screen.getByLabelText('Couleur')).toBeInTheDocument()
  })

  it('hands the chosen tool to the engine', async () => {
    render(<ImageDocument documentId="doc-1" />)
    await userEvent.click(screen.getByRole('button', { name: /^Pipette/ }))
    expect(setTool).toHaveBeenCalledWith('picker')
  })

  it('opens the eraser modes on hover', async () => {
    render(<ImageDocument documentId="doc-1" />)
    await userEvent.hover(screen.getByRole('button', { name: /^Gomme ponctuelle/ }))
    expect(await screen.findByRole('menuitem', { name: 'Gomme sélective' })).toBeInTheDocument()
  })

  it('disables undo when there is nothing to undo', () => {
    render(<ImageDocument documentId="doc-1" />)
    expect(screen.getByRole('button', { name: /Annuler/ })).toBeDisabled()
  })

  describe('dropping a picture on it', () => {
    const picture: Asset = {
      id: 'asset-7',
      name: 'concept art',
      type: 'image',
      location: 'local',
      tags: [],
      createdAt: '2026-08-08T10:00:00.000Z',
    }

    /** A drop carrying our own MIME type, as the asset browser sends it. */
    function drop(target: Element): void {
      const transfer = dragTransfer()
      transfer.setData(ASSET_DRAG_TYPE, picture.id)
      fireEvent.drop(target, { dataTransfer: transfer })
    }

    it('lays the dropped asset down as a layer of its own', async () => {
      useAssets.setState({ items: [picture] })
      const { container } = render(<ImageDocument documentId="doc-1" />)

      const surface = container.querySelector('.relative.min-w-0')
      expect(surface).not.toBeNull()
      if (surface) drop(surface)

      await waitFor(() =>
        expect(canvasOf(useCanvases.getState(), 'doc-1').layers.at(-1)?.name).toBe('concept art'),
      )
    })

    it('answers a drag with the same edge every other droppable surface shows', () => {
      const { container } = render(<ImageDocument documentId="doc-1" />)
      const surface = container.querySelector('.relative.min-w-0')
      expect(surface).not.toBeNull()

      const dataTransfer = dragTransfer()
      startAssetDrag({ dataTransfer }, { id: 'asset-1', type: 'image' })
      if (surface) fireEvent.dragOver(surface, { dataTransfer })

      expect(container.querySelector('.outline-accent')).not.toBeNull()
    })

    // It used to light up for anything at all, which also meant it swallowed files dragged in
    // from the desktop — the drop then did nothing, silently.
    it('stays quiet for a drag that is not one of ours', () => {
      const { container } = render(<ImageDocument documentId="doc-1" />)
      const surface = container.querySelector('.relative.min-w-0')
      if (surface) fireEvent.dragOver(surface, { dataTransfer: dragTransfer() })

      expect(container.querySelector('.outline-accent')).toBeNull()
    })
  })

  // Placing a picture arms no gesture: it is a choice, and the shelf is where one is made.
  it('brings the shelf forward instead of arming a tool that draws nothing', async () => {
    useTools.setState({ open: { bottom: { primary: 'assets' } }, focusedZone: null })
    render(<ImageDocument documentId="doc-1" />)

    await userEvent.hover(screen.getByRole('button', { name: /^Rectangle/ }))
    await userEvent.click(await screen.findByRole('menuitem', { name: /^Image/ }))

    expect(useTools.getState().focusedZone).toBe('bottom')
    expect(setTool).not.toHaveBeenCalledWith('shape')
  })
})

/**
 * A shortcut runs outside React and has nowhere to report to: a dismissed dialog and a volume
 * that refused the write look exactly alike from the canvas, and only one of the two is worth
 * knowing about.
 */
describe('exporting the canvas', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    useCanvases.setState({ states: {}, histories: {} })
    useDocuments.setState({
      documents: { 'doc-1': { id: 'doc-1', kind: 'image', workspace: 'image', title: 'Poster' } },
      activeId: 'doc-1',
    })
  })

  it('records a write the disk refused', async () => {
    const watched = bridgeWatchingLogs({
      dialog: { exportPicture: () => Promise.reject(new Error('read-only volume')) },
    })
    render(<ImageDocument documentId="doc-1" />)

    await userEvent.keyboard('{Meta>}{Shift>}E{/Shift}{/Meta}')

    await waitFor(() =>
      expect(watched.report).toHaveBeenCalledWith(
        expect.objectContaining({
          scope: 'image.export',
          message: expect.stringContaining('read-only volume'),
        }),
      ),
    )
  })
})
