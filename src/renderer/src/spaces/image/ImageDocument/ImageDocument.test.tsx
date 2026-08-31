import { act, fireEvent, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { Asset } from '@shared/domain/asset'
import { ASSET_DRAG_TYPE, startAssetDrag } from '@/helpers/assetDrag'
import { BRUSH_SIZE } from '@/engines/canvas/brush'
import { DEFAULT_CANVAS, pixelLayer } from '@/engines/canvas/canvasState'
import { canUndo } from '@/engines/core/history'
import { PANE_TOOLBAR } from '@/components/styles'
import { dragTransfer } from '@/helpers/drag-fixtures'
import { useAssets } from '@/stores/assets'
import { installCanvas } from '@/stores/canvas-fixtures'
import { canvasOf, canvasHistoryOf, useCanvases } from '@/stores/canvases'
import { useCanvasViews } from '@/stores/canvasViews'
import { useDocuments } from '@/stores/documents'
import { useLayouts } from '@/stores/layouts'
import { bridgeWatchingLogs } from '@/services/fakeBridge'
import { arrangedFor } from '@/stores/tool-fixtures'
import { useTools } from '@/stores/tools'
import { ImageDocument } from './ImageDocument'

const setTool = vi.fn()
const setShape = vi.fn()
const setBrush = vi.fn()
const applyCrop = vi.fn()
const dropCrop = vi.fn()
const mergeInto = vi.fn()
const setLanguage = vi.fn()

// jsdom has no WebGL context: the engine is exercised by hand, not here. What this covers is
// that the document wires the bar to the right calls.
vi.mock('@/engines/canvas/CanvasEngine', () => {
  return {
    // The brush's own defaults are NOT doubled here: they live in `engines/canvas/brush`, which
    // holds no Pixi, so the real ones are used. A copy kept here could drift from them in
    // silence — and a double that no longer doubles is a test that lies.
    CanvasEngine: class {
      mount = vi.fn(() => Promise.resolve())
      apply = vi.fn()
      dispose = vi.fn()
      setView = vi.fn()
      setLanguage = setLanguage
      setTool = setTool
      setBrush = setBrush
      loadInto = vi.fn(() => Promise.resolve())
      setSelection = vi.fn()
      setEditingText = vi.fn()
      setSelectionShape = vi.fn()
      setShape = setShape
      snapshot = vi.fn(() => Promise.resolve('data:image/png;base64,AAAA'))
      applyCrop = applyCrop
      dropCrop = dropCrop
      mergeInto = mergeInto
      pixelSnapshots = vi.fn(() => Promise.resolve([]))
      restoreSnapshot = vi.fn(() => Promise.resolve())
    },
  }
})

describe('ImageDocument', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    useLayouts.setState({ activeWorkspace: 'image', home: false })
  })

  /**
   * The rulers are graduated by the engine, which has no way to ask what language the window is
   * in — it is pushed, like the view. Left unpushed, the graduations keep the language they were
   * mounted in while the inspector beside them changes, and that is a defect this very lot
   * shipped once before the review caught it.
   */
  it('hands the engine the language its graduations are written in', () => {
    render(<ImageDocument documentId="doc-1" />)

    expect(setLanguage).toHaveBeenCalledWith('fr')
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

  /**
   * The inset comes from the design system; only the ruler offset is this space's own, and it is
   * a runtime measure no class can express.
   */
  it('places its bar where every space places it, rulers aside', () => {
    render(<ImageDocument documentId="doc-1" />)
    expect(screen.getByRole('toolbar')).toHaveClass(PANE_TOOLBAR)
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
      expect(
        await screen.findByRole('menuitemradio', { name: new RegExp(`^${name}`) }),
      ).toBeVisible()
    }
  })

  it('arms the group with the mode chosen, and hands it to the engine', async () => {
    render(<ImageDocument documentId="doc-1" />)

    await userEvent.hover(screen.getByRole('button', { name: /^Déplacement/ }))
    await userEvent.click(await screen.findByRole('menuitemradio', { name: /^Main/ }))

    expect(setTool).toHaveBeenLastCalledWith('hand')
    expect(screen.getByRole('button', { name: /^Main/ })).toBeInTheDocument()
  })

  /**
   * The path the user actually takes: a key on the window, and the tool armed as a result.
   *
   * Asserting that the bar carries the right label would prove nothing — it carried them all
   * along while `IMAGE_TOOLS` held plain strings and no one listened on the other side. Sixteen
   * keys were advertised on the buttons and not one of them did anything.
   */
  // Through `fireEvent`, which wraps the dispatch in `act`: a bare `dispatchEvent` leaves the
  // state React set behind it unflushed, and the effect that hands the tool over never runs.
  const press = (key: string, shiftKey = false): void => {
    fireEvent.keyDown(window, { code: key, shiftKey })
  }

  /**
   * Only the document in front listens: Dockview keeps hidden tabs mounted, and one left behind
   * would eat the keys the space in front is waiting for.
   */
  const armed = (): void => {
    useDocuments.setState({ activeId: 'doc-1' })
    render(<ImageDocument documentId="doc-1" />)
  }

  /**
   * Arms a tool by its key, which is the path a hand takes — and the only one that reaches a
   * mode a group does not open on, the pencil being one. Rendered once: a second `render` in the
   * same case would leave two bars answering the same query.
   */
  const armedWith = (key: string, shift = false): void => {
    if (screen.queryAllByRole('button', { name: /^Pipette/ }).length === 0) armed()
    press(key, shift)
  }

  it('arms the brush when its key is pressed', () => {
    armed()

    press('KeyB')

    expect(setTool).toHaveBeenLastCalledWith('brush')
  })

  it('arms the eyedropper, the bucket and the eraser by their own keys', () => {
    armed()

    press('KeyI')
    expect(setTool).toHaveBeenLastCalledWith('picker')

    press('KeyG')
    expect(setTool).toHaveBeenLastCalledWith('fill')

    press('KeyE')
    expect(setTool).toHaveBeenLastCalledWith('eraser')
  })

  // The bar has to follow the key: an armed tool the buttons disagree with is worse than none.
  it('moves the armed button with the key, not just the engine', () => {
    armed()

    press('KeyB')

    expect(screen.getByRole('button', { name: /^Pinceau/ })).toHaveAttribute('aria-pressed', 'true')
    expect(screen.getByRole('button', { name: /^Déplacement/ })).toHaveAttribute(
      'aria-pressed',
      'false',
    )
  })

  /**
   * `L` was claimed by the lasso and by the line at once, which a registry makes impossible.
   * The lasso keeps it, as it does in every editor that has one; the line takes Shift and the
   * shape key `U`, since that is the group it belongs to.
   */
  it('gives L to the lasso and Shift+U to the line', () => {
    armed()

    press('KeyL')
    expect(setTool).toHaveBeenLastCalledWith('select')

    press('KeyU', true)
    expect(setTool).toHaveBeenLastCalledWith('shape')
    expect(setShape).toHaveBeenLastCalledWith('line')
  })

  // Read off the registry rather than written on the button, so a remapped key moves with it.
  it('wears the key the registry gives it', () => {
    render(<ImageDocument documentId="doc-1" />)

    expect(screen.getByRole('button', { name: 'Pinceau (B)' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Pipette (I)' })).toBeInTheDocument()
  })

  it('offers a colour input', () => {
    armedWith('KeyB')
    expect(screen.getByLabelText('Couleur')).toBeInTheDocument()
  })

  /**
   * ⏎ and ⎋ answered a crop frame and nothing else did — a key nothing on screen names. Greyed
   * rather than dropped while there is no frame, the rule the rest of this bar follows.
   */
  describe('answering a crop frame', () => {
    it('greys both buttons while no frame is drawn', () => {
      useCanvasViews.getState().setCropFrame('doc-1', false)
      render(<ImageDocument documentId="doc-1" />)

      expect(screen.getByRole('button', { name: /^Appliquer le recadrage/ })).toBeDisabled()
      expect(screen.getByRole('button', { name: /^Abandonner le recadrage/ })).toBeDisabled()
    })

    it('crops to the frame the engine drew', async () => {
      useCanvasViews.getState().setCropFrame('doc-1', true)
      render(<ImageDocument documentId="doc-1" />)

      await userEvent.click(screen.getByRole('button', { name: /^Appliquer le recadrage/ }))

      expect(applyCrop).toHaveBeenCalled()
    })

    it('takes that frame away without cropping', async () => {
      useCanvasViews.getState().setCropFrame('doc-1', true)
      render(<ImageDocument documentId="doc-1" />)

      await userEvent.click(screen.getByRole('button', { name: /^Abandonner le recadrage/ }))

      expect(dropCrop).toHaveBeenCalled()
      expect(applyCrop).not.toHaveBeenCalled()
    })

    // It ACTS, so it has no pressed state: a button for ever announcing "toggle, not pressed"
    // describes something it does not have.
    it('announces neither of them as a toggle', () => {
      useCanvasViews.getState().setCropFrame('doc-1', true)
      render(<ImageDocument documentId="doc-1" />)

      expect(screen.getByRole('button', { name: /^Appliquer le recadrage/ })).not.toHaveAttribute(
        'aria-pressed',
      )
    })
  })

  /**
   * The brush shipped with a size, a hardness and an opacity that nothing on screen could reach:
   * every stroke was 24 px wide for the life of the session.
   */
  describe('the brush settings', () => {
    const openSettings = async (): Promise<void> => {
      armedWith('KeyB')
      await userEvent.click(screen.getByRole('button', { name: 'Réglages du pinceau' }))
    }

    it('offers all three behind the brush button', async () => {
      await openSettings()

      expect(await screen.findByLabelText('Taille')).toBeInTheDocument()
      expect(screen.getByLabelText('Dureté')).toBeInTheDocument()
      expect(screen.getByLabelText('Opacité')).toBeInTheDocument()
    })

    it('hands a new size straight to the engine', async () => {
      await openSettings()
      fireEvent.change(await screen.findByLabelText('Taille'), { target: { value: '96' } })

      expect(setBrush).toHaveBeenLastCalledWith(expect.objectContaining({ size: 96 }))
    })

    it('shows the size it is set to, so the next stroke is no longer a guess', async () => {
      await openSettings()

      expect(await screen.findByLabelText('Taille')).toHaveValue('24')
      expect(screen.getByLabelText('Taille')).toHaveAttribute('max', String(BRUSH_SIZE.max))
    })
  })

  /**
   * A control the armed tool ignores is gone, not greyed — the rule the inspector already applies
   * to a sprite, which gets no shadow section rather than a dead one. The hardness slider under
   * the pencil is the case that named it: live, draggable, and moving nothing.
   *
   * What each tool reads is `BRUSH_SETTINGS_BY_TOOL`, and the engine's `softness()` asks the same
   * table — so a row that shows here is a row that does something there.
   */
  describe('the paint settings follow the armed tool', () => {
    const settingsUnder = async (key: string, shift = false): Promise<string[]> => {
      armedWith(key, shift)
      const flyout = screen.queryByRole('button', { name: 'Réglages du pinceau' })
      if (!flyout) return []

      await userEvent.click(flyout)
      await screen.findByLabelText('Taille')
      return ['Taille', 'Dureté', 'Opacité'].filter(name => screen.queryByLabelText(name) !== null)
    }

    it('offers hardness under the brush, the only tool that feathers', async () => {
      expect(await settingsUnder('KeyB')).toEqual(['Taille', 'Dureté', 'Opacité'])
    })

    it('takes hardness away under the pencil, which is hard by definition', async () => {
      expect(await settingsUnder('KeyB', true)).toEqual(['Taille', 'Opacité'])
    })

    it('takes hardness away under the eraser as well', async () => {
      expect(await settingsUnder('KeyE')).toEqual(['Taille', 'Opacité'])
    })

    it('takes hardness away under the shapes, whose size is a stroke width', async () => {
      expect(await settingsUnder('KeyU')).toEqual(['Taille', 'Opacité'])
    })

    /**
     * The colour belongs to the DOCUMENT, not to the tool: shown only under a painting tool, it
     * could not be chosen before picking a brush, and nothing said which colour the next stroke
     * would be. Every one of these tools is one the bar opens on or reaches for mid-work.
     */
    it.each([
      ['the eraser', 'KeyE'],
      ['the bucket', 'KeyG'],
      ['the eyedropper', 'KeyI'],
      ['the pointer', 'KeyV'],
    ])('keeps the colour under %s, whatever that tool reads', (_name, key) => {
      armedWith(key)

      expect(screen.getByLabelText('Couleur')).toBeInTheDocument()
    })

    // The bucket sets a colour and nothing else: a flyout of sliders it never reads would be
    // the same defect one control further along.
    it('offers the bucket no slider flyout at all', () => {
      armedWith('KeyG')

      expect(screen.queryByRole('button', { name: 'Réglages du pinceau' })).not.toBeInTheDocument()
    })

    it.each([
      ['the eyedropper', 'KeyI'],
      ['the pointer', 'KeyV'],
      ['the crop frame', 'KeyC'],
      ['the caption tool', 'KeyT'],
    ])('offers no setting at all under %s, which paints no pixel', (_name, key) => {
      armedWith(key)

      expect(screen.queryByRole('button', { name: 'Réglages du pinceau' })).not.toBeInTheDocument()
    })
  })

  describe('the bracket keys', () => {
    it('steps the size up and down through the registry, not by a listener of its own', () => {
      armedWith('KeyB')

      press('BracketRight')
      expect(setBrush).toHaveBeenLastCalledWith(expect.objectContaining({ size: 34 }))

      press('BracketLeft')
      expect(setBrush).toHaveBeenLastCalledWith(expect.objectContaining({ size: 24 }))
    })

    // The settings are not on screen under the pointer, so a bracket there moved a number nobody
    // could see — and the surprise arrived at the first stroke, long after the key.
    it('does nothing under a tool that shows no size', () => {
      armedWith('KeyV')
      setBrush.mockClear()

      press('BracketRight')

      expect(setBrush).not.toHaveBeenCalled()
    })

    it('leaves the colour alone while it resizes', () => {
      armed()

      press('BracketRight')
      expect(setBrush).toHaveBeenLastCalledWith(expect.objectContaining({ color: 0x000000 }))
    })
  })

  it('hands the chosen tool to the engine', async () => {
    render(<ImageDocument documentId="doc-1" />)
    await userEvent.click(screen.getByRole('button', { name: /^Pipette/ }))
    expect(setTool).toHaveBeenCalledWith('picker')
  })

  // The paint group, the eraser having become a single button when the mode behind its second
  // row turned out to arm the very same gesture.
  it('opens a group’s modes on hover', async () => {
    render(<ImageDocument documentId="doc-1" />)
    await userEvent.hover(screen.getByRole('button', { name: /^Pinceau/ }))
    // A regex, not the bare label: a row that carries a key wears it in its accessible name.
    expect(await screen.findByRole('menuitemradio', { name: /^Crayon/ })).toBeInTheDocument()
  })

  it('draws no history button of its own', () => {
    render(<ImageDocument documentId="doc-1" />)
    expect(screen.queryByRole('button', { name: /Annuler/ })).not.toBeInTheDocument()
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

    /**
     * The surface takes the drag — `preventDefault` is what makes a drop possible at all — and
     * draws NO frame doing it.
     *
     * The frame was there and is gone: this surface fills the centre, so outlining it says
     * nothing the user cannot already see, and the pointer's own "+" says it better. It stays on
     * the surfaces where it IS the answer — a material's channel slots, a field — which is what
     * `AssetDropTarget.outlined` documents and `AssetDropTarget.test.tsx` holds.
     */
    it('takes our drag without drawing a frame over the middle of the window', () => {
      const { container } = render(<ImageDocument documentId="doc-1" />)
      const surface = container.querySelector('.relative.min-w-0')
      expect(surface).not.toBeNull()

      const dataTransfer = dragTransfer()
      startAssetDrag({ dataTransfer }, { id: 'asset-1', type: 'image' })
      const notPrevented = surface && fireEvent.dragOver(surface, { dataTransfer })

      expect(notPrevented).toBe(false)
      expect(container.querySelector('.outline-accent')).toBeNull()
    })

    // It used to light up for anything at all, which also meant it swallowed files dragged in
    // from the desktop — the drop then did nothing, silently. The light is gone; the swallowing
    // must stay gone with it, which is what the default NOT being prevented says.
    it('leaves a drag that is not one of ours to the platform', () => {
      const { container } = render(<ImageDocument documentId="doc-1" />)
      const surface = container.querySelector('.relative.min-w-0')

      const notPrevented = surface && fireEvent.dragOver(surface, { dataTransfer: dragTransfer() })

      expect(notPrevented).toBe(true)
    })
  })

  // Placing a picture arms no gesture: it is a choice, and the shelf is where one is made.
  it('brings the shelf forward instead of arming a tool that draws nothing', async () => {
    useTools.setState({
      arrangements: arrangedFor('image', { open: { left: { primary: 'assets' } } }),
      focusedZone: null,
    })
    render(<ImageDocument documentId="doc-1" />)

    await userEvent.hover(screen.getByRole('button', { name: /^Rectangle/ }))
    await userEvent.click(await screen.findByRole('menuitemradio', { name: /^Image/ }))

    expect(useTools.getState().focusedZone).toBe('left')
    expect(setTool).not.toHaveBeenCalledWith('shape')
  })
})

describe('merging the layer below', () => {
  const DOCUMENT = 'doc-merge'

  // Three flat layers, so `layerBelow` has an unambiguous answer for each of them.
  const select = (activeLayerId: string) =>
    installCanvas(DOCUMENT, {
      ...DEFAULT_CANVAS,
      layers: [pixelLayer('a', 'A'), pixelLayer('b', 'B'), pixelLayer('c', 'C')],
      activeLayerId,
    })

  // The sibling `describe` above owns the one on line 49, so this suite needs its own.
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('composes the layer selected now, not the one selected when the space opened', () => {
    select('b')
    render(<ImageDocument documentId={DOCUMENT} />)

    act(() => select('c'))
    fireEvent.keyDown(window, { code: 'KeyE', metaKey: true })

    expect(mergeInto).toHaveBeenCalledWith('b', 'c')
  })

  it('offers nothing at the bottom of the stack', () => {
    select('a')
    render(<ImageDocument documentId={DOCUMENT} />)

    fireEvent.keyDown(window, { code: 'KeyE', metaKey: true })

    expect(mergeInto).not.toHaveBeenCalled()
    // The history too: `run` stacks a command whether or not it changed anything, so a merge that
    // let the command through at the bottom would leave a ⌘Z that undoes nothing.
    expect(canUndo(canvasHistoryOf(useCanvases.getState(), DOCUMENT))).toBe(false)
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
    useDocuments.setState({
      documents: {
        'doc-1': {
          id: 'doc-1',
          kind: 'image',
          workspace: 'image',
          title: 'Poster',
          path: 'documents/Poster.ora',
        },
      },
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
