import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { TextureField, type TextureOption } from './TextureField'

const OPTIONS: TextureOption[] = [
  { id: 'tex-1', name: 'Brick', url: 'scenario://asset/tex-1' },
  { id: 'tex-2', name: 'Rust', url: 'scenario://asset/tex-2' },
]

function renderField(value: string | null = null, options = OPTIONS) {
  const onChange = vi.fn()

  render(
    <TextureField
      label="Texture"
      value={value}
      options={options}
      onChange={onChange}
      emptyLabel="Aucune"
      chooseLabel="Choisir une texture"
      clearLabel="Retirer la texture"
      emptyHint="Laisse ce champ sans image"
      optionHint="Pose cette image dans le champ"
    />,
  )

  return { onChange }
}

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
})
