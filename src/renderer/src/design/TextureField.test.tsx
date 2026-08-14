import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { PICTURES, type Asset, type AssetType } from '@shared/domain/asset'
import { startAssetDrag } from '@/helpers/asset-drag'
import { dragTransfer } from '@/helpers/drag-fixtures'
import { useAssets } from '@/stores/assets'
import { TextureField, type TextureFieldProps, type TextureOption } from './TextureField'

const OPTIONS: TextureOption[] = [
  { id: 'tex-1', name: 'Brick', url: 'scenario://asset/tex-1' },
  { id: 'tex-2', name: 'Rust', url: 'scenario://asset/tex-2' },
]

/** What the drag carries — resolved against the catalogue by the drop, never sent with it. */
const DROPPED: Asset = {
  id: 'asset_1',
  name: 'moss.png',
  type: 'image',
  location: 'local',
  tags: [],
  createdAt: '2026-08-14T10:00:00.000Z',
}

function dragging(type: AssetType): DataTransfer {
  const dataTransfer = dragTransfer()
  startAssetDrag({ dataTransfer }, { id: DROPPED.id, type })
  return dataTransfer
}

/** The field with everything a case does not vary already answered. */
function Slot(props: Partial<TextureFieldProps> & Pick<TextureFieldProps, 'value' | 'onChange'>) {
  return (
    <TextureField
      label="Texture"
      options={OPTIONS}
      emptyLabel="Aucune"
      chooseLabel="Choisir une texture"
      clearLabel="Retirer la texture"
      emptyHint="Laisse ce champ sans image"
      optionHint="Pose cette image dans le champ"
      {...props}
    />
  )
}

function renderField(value: string | null = null, options = OPTIONS) {
  const onChange = vi.fn()
  render(<Slot value={value} onChange={onChange} options={options} />)
  return { onChange }
}

/** The row itself, which the drop lands on — read through the one word an empty slot draws. */
const emptyRow = (): Element => screen.getByText('Aucune').parentElement as Element

const OPEN = { label: 'Ouvrir', hint: 'Double-cliquez pour ouvrir', run: () => {} }

describe('TextureField', () => {
  it('says the slot is empty rather than showing nothing', () => {
    renderField(null)

    expect(screen.getByText('Aucune')).toBeInTheDocument()
  })

  it('names the texture the slot holds', () => {
    renderField('tex-2')

    expect(screen.getByText('Rust')).toBeInTheDocument()
  })

  it('reports the identifier of what was picked, never the picture', async () => {
    const { onChange } = renderField()

    await userEvent.click(screen.getByRole('button', { name: /Choisir une texture/ }))
    await userEvent.click(await screen.findByRole('menuitemradio', { name: /Brick/ }))

    expect(onChange).toHaveBeenCalledWith('tex-1')
  })

  // Choosing no texture is a choice, and belongs in the menu beside the others.
  it('offers "none" among the choices', async () => {
    const { onChange } = renderField('tex-1')

    await userEvent.click(screen.getByRole('button', { name: /Choisir une texture/ }))
    await userEvent.click(await screen.findByRole('menuitemradio', { name: /Aucune/ }))

    expect(onChange).toHaveBeenCalledWith(null)
  })

  it('clears the slot from the row itself', async () => {
    const { onChange } = renderField('tex-1')

    await userEvent.click(screen.getByRole('button', { name: /Retirer la texture/ }))

    expect(onChange).toHaveBeenCalledWith(null)
  })

  // Five dead crosses on a fresh material is five buttons that do nothing.
  it('offers nothing to clear while the slot is empty', () => {
    renderField(null)

    expect(screen.queryByRole('button', { name: /Retirer la texture/ })).not.toBeInTheDocument()
  })

  // What "none" means is the caller's business — no picture, the studio's light, the document's
  // font — and the label cannot carry it. Hence two sentences rather than one.
  it('lets the caller say what each kind of row does', async () => {
    renderField('tex-1')

    await userEvent.click(screen.getByRole('button', { name: /Choisir une texture/ }))

    const none = await screen.findByRole('menuitemradio', { name: /Aucune/ })
    expect(none).toHaveAttribute('data-tooltip-content', 'Laisse ce champ sans image')
    expect(screen.getByRole('menuitemradio', { name: 'Brick' })).toHaveAttribute(
      'data-tooltip-content',
      'Pose cette image dans le champ',
    )
    // An `aria-label` over a visible label replaces it for a screen reader (WCAG 2.5.3).
    expect(none).not.toHaveAttribute('aria-label')
  })

  it('cannot be opened on a project with no usable asset', () => {
    renderField(null, [])

    expect(screen.getByRole('button', { name: /Choisir une texture/ })).toBeDisabled()
  })

  /**
   * The two gestures a slot answers to besides its menu, and the reason the menu alone was not
   * enough: a 28 px thumbnail beside a name reads as a picture, not as a control, so nothing on
   * the row said it could be changed without opening a list — or looked at at all.
   */
  describe('the picture the slot holds', () => {
    beforeEach(() => {
      useAssets.setState({ items: [DROPPED] })
    })

    it('takes an asset dragged onto the row', async () => {
      const onChange = vi.fn()
      render(<Slot value={null} onChange={onChange} accepts={PICTURES} />)

      fireEvent.drop(emptyRow(), { dataTransfer: dragging('image') })

      await waitFor(() => expect(onChange).toHaveBeenCalledWith('asset_1'))
    })

    // Which kinds a row welcomes, and what it draws while one flies over it, belong to
    // `AssetDropTarget` and are held by its own file: what this one owns is only whether the
    // field mounts one at all.
    //
    // Undroppable where a drop means nothing: `FontField` offers the fonts of the system, and no
    // asset of the project is one.
    it('takes nothing at all where the caller named no kind', () => {
      const onChange = vi.fn()
      render(<Slot value={null} onChange={onChange} />)

      fireEvent.drop(emptyRow(), { dataTransfer: dragging('image') })

      expect(onChange).not.toHaveBeenCalled()
    })

    it('opens what it holds on a double-click', async () => {
      const run = vi.fn()
      render(<Slot value="tex-1" onChange={vi.fn()} open={{ ...OPEN, run }} />)

      await userEvent.dblClick(screen.getByRole('button', { name: 'Ouvrir' }))

      expect(run).toHaveBeenCalled()
    })

    // A focus stop that leads nowhere is one more Tab to cross for nothing.
    it('offers nothing to open while the slot is empty', () => {
      render(<Slot value={null} onChange={vi.fn()} open={OPEN} />)

      expect(screen.queryByRole('button', { name: 'Ouvrir' })).not.toBeInTheDocument()
    })

    /**
     * A document outlives the picture it points at: nothing rewrites a material when an asset
     * leaves the project. The row already reads « Aucune » in that case — offering to open what
     * it just said it does not hold is a button that answers nothing when pressed.
     */
    it('offers nothing to open for an id the project no longer holds', () => {
      render(<Slot value="tex-gone" onChange={vi.fn()} open={OPEN} />)

      expect(screen.getByText('Aucune')).toBeInTheDocument()
      expect(screen.queryByRole('button', { name: 'Ouvrir' })).not.toBeInTheDocument()
    })
  })
})
