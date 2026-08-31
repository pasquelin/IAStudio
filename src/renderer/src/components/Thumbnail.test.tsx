import { render } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { Thumbnail } from './Thumbnail'

function picture(): HTMLImageElement | null {
  return document.querySelector('img')
}

describe('Thumbnail', () => {
  // The size belongs to the caller: a row and a header ask for different ones.
  it('shows the picture at the size it is given', () => {
    render(<Thumbnail url="https://cdn/one.png" className="size-8" />)

    expect(picture()).toHaveAttribute('src', 'https://cdn/one.png')
    expect(picture()).toHaveClass('size-8')
  })

  it('keeps its shape when there is no picture', () => {
    const { container } = render(<Thumbnail className="size-8" />)

    expect(picture()).toBeNull()
    expect(container.querySelector('svg')).toBeInTheDocument()
    expect(container.firstElementChild).toHaveClass('size-8')
  })
})
