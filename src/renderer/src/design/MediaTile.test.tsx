import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { MediaTile } from './MediaTile'

function picture(): HTMLImageElement | null {
  return document.querySelector('img')
}

describe('MediaTile', () => {
  it('shows the picture and its caption', () => {
    render(<MediaTile url="https://cdn/one.png" caption="Dark Anime" />)

    expect(picture()).toHaveAttribute('src', 'https://cdn/one.png')
    expect(screen.getByText('Dark Anime')).toBeInTheDocument()
  })

  /**
   * The URLs the API signs expire, so a tile that has been on screen a while can find its
   * picture gone. Left alone, the browser draws its broken-image glyph inside the card.
   */
  it('falls back to the placeholder when the picture fails to load', () => {
    render(<MediaTile url="https://cdn/expired.png" caption="Gone" />)

    fireEvent.error(picture() as HTMLImageElement)

    expect(picture()).toBeNull()
    expect(screen.getByText('Gone')).toBeInTheDocument()
  })

  it('shows the placeholder when there is no picture at all', () => {
    render(<MediaTile caption="Scenario LLM" />)

    expect(picture()).toBeNull()
    expect(screen.getByText('Scenario LLM')).toBeInTheDocument()
  })

  // The caption has to stay readable over a picture; it is never the picture's own text.
  it('keeps the caption when a badge is given too', () => {
    render(<MediaTile url="https://cdn/one.png" caption="Flux" badge={<span>Featured</span>} />)

    expect(screen.getByText('Featured')).toBeInTheDocument()
    expect(screen.getByText('Flux')).toBeInTheDocument()
  })
})
