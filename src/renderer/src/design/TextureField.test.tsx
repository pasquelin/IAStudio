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

  it('cannot be opened on a project with no usable asset', () => {
    renderField(null, [])

    expect(screen.getByRole('button', { name: /Choisir une texture/ })).toBeDisabled()
  })
})
