import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { IMAGE_TOOLS } from './image-tools'
import { ImageDocument } from './ImageDocument'

// The expected labels are French because they come from the i18n bundle: they are user-facing
// text, not identifiers — same convention as `design/Toolbar.test.tsx`.
const EXPECTED_LABELS = ['Pinceau', 'Gomme', 'Sélection', 'Recadrer', 'Texte']

describe('ImageDocument', () => {
  it('renders the shared toolbar with the image tools', () => {
    render(<ImageDocument />)
    expect(screen.getByRole('button', { name: 'Pinceau' })).toBeInTheDocument()
  })

  it('renders every declared tool disabled while there is no engine behind them', () => {
    render(<ImageDocument />)
    for (const label of EXPECTED_LABELS) {
      expect(screen.getByRole('button', { name: label })).toBeDisabled()
    }
  })

  it('declares exactly the tools the labels cover', () => {
    expect(IMAGE_TOOLS).toHaveLength(EXPECTED_LABELS.length)
  })

  it('names every tool through i18n rather than a literal', () => {
    for (const tool of IMAGE_TOOLS) expect(tool.labelKey).toMatch(/^imageTools\./)
  })
})
