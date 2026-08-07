import { render, screen } from '@testing-library/react'
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
    useCanvases.setState({ states: {}, histories: {} })
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

  it('offers every shape Figma does, behind the shapes group', async () => {
    render(<ImageDocument documentId="doc-1" />)
    await userEvent.hover(screen.getByRole('button', { name: /^Rectangle/ }))

    // The accessible name carries the shortcut, so `Line` reads `Line (L)`.
    for (const name of ['Trait', 'Flèche', 'Ellipse', 'Polygone', 'Étoile']) {
      expect(await screen.findByRole('menuitem', { name: new RegExp(`^${name}`) })).toBeVisible()
    }
  })

  it('arms the group with the mode chosen, and hands it to the engine', async () => {
    render(<ImageDocument documentId="doc-1" />)

    await userEvent.hover(screen.getByRole('button', { name: /^Déplacement/ }))
    await userEvent.click(await screen.findByRole('menuitem', { name: /^Main/ }))

    expect(setTool).toHaveBeenLastCalledWith('hand')
    expect(screen.getByRole('button', { name: /^Main/ })).toBeInTheDocument()
  })

  it('offers a colour input', () => {
    render(<ImageDocument documentId="doc-1" />)
    expect(screen.getByLabelText('Couleur')).toBeInTheDocument()
  })

  it('hands the chosen tool to the engine', async () => {
    render(<ImageDocument documentId="doc-1" />)
    await userEvent.click(screen.getByRole('button', { name: /^Pipette/ }))
    expect(setTool).toHaveBeenCalledWith('picker')
  })

  it('opens the eraser modes on hover', async () => {
    render(<ImageDocument documentId="doc-1" />)
    await userEvent.hover(screen.getByRole('button', { name: /^Gomme ponctuelle/ }))
    expect(await screen.findByRole('menuitem', { name: 'Gomme sélective' })).toBeInTheDocument()
  })

  it('disables undo when there is nothing to undo', () => {
    render(<ImageDocument documentId="doc-1" />)
    expect(screen.getByRole('button', { name: /Annuler/ })).toBeDisabled()
  })
})
