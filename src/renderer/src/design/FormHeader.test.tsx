import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { FormHeader } from './FormHeader'

describe('FormHeader', () => {
  it('names what the form is for', () => {
    render(<FormHeader title="GPT Image 2" />)

    expect(screen.getByText('GPT Image 2')).toBeInTheDocument()
  })

  it('carries a way back where one is offered, and nothing where none is', () => {
    const { rerender } = render(<FormHeader title="Background remover" leading={<button />} />)
    expect(screen.getByRole('button')).toBeInTheDocument()

    rerender(<FormHeader title="GPT Image 2" />)
    expect(screen.queryByRole('button')).not.toBeInTheDocument()
  })

  /**
   * The defect this exists for, and it cannot be seen in jsdom: `truncate` sets
   * `overflow: hidden`, which disarms the `min-height: auto` that stops a flex item being
   * squeezed below its content. Bare, the line was crushed to nothing and the form clipped the
   * model's name across its middle. `shrink-0` is what puts the protection back.
   */
  it('refuses to be squeezed, which is what truncate took away', () => {
    const { container } = render(<FormHeader title="GPT Image 2" />)

    expect(container.firstElementChild).toHaveClass('shrink-0')
  })
})
