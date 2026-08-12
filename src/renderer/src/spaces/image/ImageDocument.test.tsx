import { act, fireEvent, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { Asset } from '@shared/domain/asset'
import { ASSET_DRAG_TYPE, startAssetDrag } from '@/helpers/asset-drag'
import { BRUSH_SIZE } from '@/engines/canvas/brush'
import { DEFAULT_CANVAS, pixelLayer } from '@/engines/canvas/canvas-state'
import { canUndo } from '@/engines/core/history'
import { PANE_TOOLBAR } from '@/design/styles'
import { dragTransfer } from '@/helpers/drag-fixtures'
import { useAssets } from '@/stores/assets'
import { installCanvas } from '@/stores/canvas-fixtures'
import { canvasOf, canvasHistoryOf, useCanvases } from '@/stores/canvases'
import { useDocuments } from '@/stores/documents'
import { useLayouts } from '@/stores/layouts'
import { bridgeWatchingLogs } from '@/services/fake-bridge'
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
    useCanvases.setState({ states: {}, histories: {} })
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

    press('KeyP')

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

    press('KeyP')

    expect(screen.getByRole('button', { name: /^Pinceau/ })).toHaveAttribute('aria-pressed', 'true')
    expect(screen.getByRole('button', { name: /^Déplacement/ })).toHaveAttribute(
      'aria-pressed',
      'false',
    )
  })

  /**
   * `L` was claimed by the lasso and by the line at once, which a registry makes impossible.
   * The lasso keeps it, as it does in every editor that has one; the line takes Shift and the
   * rectangle's key, since that is the group it belongs to.
   */
  it('gives L to the lasso and Shift+R to the line', () => {
    armed()

    press('KeyL')
    expect(setTool).toHaveBeenLastCalledWith('select')

    press('KeyR', true)
    expect(setTool).toHaveBeenLastCalledWith('shape')
    expect(setShape).toHaveBeenLastCalledWith('line')
  })

  // Read off the registry rather than written on the button, so a remapped key moves with it.
  it('wears the key the registry gives it', () => {
    render(<ImageDocument documentId="doc-1" />)

    expect(screen.getByRole('button', { name: 'Pinceau (P)' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Pipette (I)' })).toBeInTheDocument()
  })

  it('offers a colour input', () => {
    armedWith('KeyP')
    expect(screen.getByLabelText('Couleur')).toBeInTheDocument()
  })

  /**
   * The brush shipped with a size, a hardness and an opacity that nothing on screen could reach:
   * every stroke was 24 px wide for the life of the session.
   */
  describe('the brush settings', () => {
    const openSettings = async (): Promise<void> => {
      armedWith('KeyP')
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
      expect(await settingsUnder('KeyP')).toEqual(['Taille', 'Dureté', 'Opacité'])
    })

    it('takes hardness away under the pencil, which is hard by definition', async () => {
      expect(await settingsUnder('KeyP', true)).toEqual(['Taille', 'Opacité'])
    })

    it('takes hardness away under the eraser as well', async () => {
      expect(await settingsUnder('KeyE')).toEqual(['Taille', 'Opacité'])
    })

    it('takes hardness away under the shapes, whose size is a stroke width', async () => {
      expect(await settingsUnder('KeyR')).toEqual(['Taille', 'Opacité'])
    })

    // Its stamp is white, which is what the erase blend reads — the swatch chose nothing.
    it('takes the colour away under the eraser, and keeps it under the bucket', () => {
      armedWith('KeyE')
      expect(screen.queryByLabelText('Couleur')).not.toBeInTheDocument()

      armedWith('KeyG')
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
      ['the crop frame', 'KeyF'],
      ['the caption tool', 'KeyT'],
    ])('shows nothing at all under %s, which paints no pixel', (_name, key) => {
      armedWith(key)

      expect(screen.queryByLabelText('Couleur')).not.toBeInTheDocument()
      expect(screen.queryByRole('button', { name: 'Réglages du pinceau' })).not.toBeInTheDocument()
    })

    /**
     * Withdrawing means leaving, not standing there empty: the bar is a flex row with a gap
     * between every pair of children, so a wrapper with nothing in it still spends one. The
     * separators are `<span>`, which is what makes an empty `<div>` here nothing but this.
     */
    it('takes its slot in the bar with it rather than leaving a gap behind', () => {
      armedWith('KeyI')

      const empty = [...screen.getByRole('toolbar').children].filter(
        child => child.tagName === 'DIV' && child.childElementCount === 0,
      )
      expect(empty).toEqual([])
    })
  })

  describe('the bracket keys', () => {
    it('steps the size up and down through the registry, not by a listener of its own', () => {
      armed()

      press('BracketRight')
      expect(setBrush).toHaveBeenLastCalledWith(expect.objectContaining({ size: 34 }))

      press('BracketLeft')
      expect(setBrush).toHaveBeenLastCalledWith(expect.objectContaining({ size: 24 }))
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

  it('opens the eraser modes on hover', async () => {
    render(<ImageDocument documentId="doc-1" />)
    await userEvent.hover(screen.getByRole('button', { name: /^Gomme ponctuelle/ }))
    expect(
      await screen.findByRole('menuitemradio', { name: 'Gomme sélective' }),
    ).toBeInTheDocument()
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
    useTools.setState({
      arrangements: arrangedFor('image', { open: { bottom: { primary: 'assets' } } }),
      focusedZone: null,
    })
    render(<ImageDocument documentId="doc-1" />)

    await userEvent.hover(screen.getByRole('button', { name: /^Rectangle/ }))
    await userEvent.click(await screen.findByRole('menuitemradio', { name: /^Image/ }))

    expect(useTools.getState().focusedZone).toBe('bottom')
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
