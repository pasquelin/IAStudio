import { fireEvent, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { useCanvases } from '@/stores/canvases'
import { ImageDocument } from './ImageDocument'

const setTool = vi.fn()
const setBrush = vi.fn()

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
      setTool = setTool
      setBrush = setBrush
    },
  }
})

describe('ImageDocument', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    useCanvases.setState({ canvases: {}, histories: {} })
  })

  it('renders the shared toolbar with the image tools', () => {
    render(<ImageDocument documentId="doc-1" />)
    expect(screen.getByRole('button', { name: /^Pinceau/ })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /^Main/ })).toBeInTheDocument()
  })

  it('hands the chosen tool to the engine', async () => {
    render(<ImageDocument documentId="doc-1" />)
    await userEvent.click(screen.getByRole('button', { name: /^Pipette/ }))
    expect(setTool).toHaveBeenCalledWith('picker')
  })

  it('opens the eraser modes on hover', async () => {
    render(<ImageDocument documentId="doc-1" />)
    await userEvent.hover(screen.getByRole('button', { name: /^Gomme \(/ }))
    expect(await screen.findByRole('menuitem', { name: 'Gomme sélective' })).toBeInTheDocument()
  })

  it('offers a colour input and a size slider', () => {
    render(<ImageDocument documentId="doc-1" />)
    expect(screen.getByLabelText('Couleur')).toBeInTheDocument()
    expect(screen.getByLabelText('Taille')).toBeInTheDocument()
  })

  it('pushes a new brush size to the engine', () => {
    render(<ImageDocument documentId="doc-1" />)
    // `userEvent` cannot drag a range input; firing the change is what the browser would do.
    fireEvent.change(screen.getByLabelText('Taille'), { target: { value: '80' } })
    expect(setBrush).toHaveBeenLastCalledWith(expect.objectContaining({ size: 80 }))
  })

  it('shows the layers panel beside the canvas', () => {
    render(<ImageDocument documentId="doc-1" />)
    expect(screen.getByRole('complementary', { name: 'Calques' })).toBeInTheDocument()
  })

  it('disables undo when there is nothing to undo', () => {
    render(<ImageDocument documentId="doc-1" />)
    expect(screen.getByRole('button', { name: /Annuler/ })).toBeDisabled()
  })
})
