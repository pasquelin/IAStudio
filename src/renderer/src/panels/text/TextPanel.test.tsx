import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it } from 'vitest'
import { DEFAULT_CANVAS, pixelLayer, textLayer } from '@/engines/canvas/canvasState'
import { installCanvas } from '@/stores/canvas-fixtures'
import { canvasOf, useCanvases } from '@/stores/canvases'
import { TextPanel } from './TextPanel'

const DOCUMENT = 'doc-1'

const withCaption = (): void =>
  installCanvas(DOCUMENT, {
    ...DEFAULT_CANVAS,
    layers: [textLayer('t', 'Bonjour', { x: 10, y: 20 })],
    activeLayerId: 't',
  })

const armed = () => canvasOf(useCanvases.getState(), DOCUMENT).layers[0]

describe('TextPanel', () => {
  beforeEach(() => {
    installCanvas(DOCUMENT)
  })

  /**
   * The panel follows the ARMED layer, as the layer stack does — not a selection. A caption born
   * on the canvas arms itself and posts none, and a panel reading one would stay empty over it.
   */
  it('says what to do while no caption is armed', () => {
    installCanvas(DOCUMENT, {
      ...DEFAULT_CANVAS,
      layers: [pixelLayer('layer-1', 'Background')],
      activeLayerId: 'layer-1',
    })

    render(<TextPanel />)

    expect(screen.getByText(/Choisissez un calque de texte/)).toBeInTheDocument()
  })

  it('hangs the lines from the edge that was chosen', async () => {
    withCaption()
    render(<TextPanel />)

    await userEvent.click(screen.getByRole('button', { name: 'Centrer' }))

    const layer = armed()
    expect(layer?.kind === 'text' && layer.align).toBe('center')
  })

  it('sets the leading as a multiple, so a bigger body keeps it', async () => {
    withCaption()
    render(<TextPanel />)

    const field = screen.getByLabelText('Interligne')
    await userEvent.clear(field)
    await userEvent.type(field, '1.8')
    await userEvent.tab()

    const layer = armed()
    expect(layer?.kind === 'text' && layer.lineHeight).toBeCloseTo(1.8)
  })

  // The box is what the words WRAP in; nothing is ever cut to it.
  it('widens the box the words wrap in', async () => {
    withCaption()
    render(<TextPanel />)

    const field = screen.getByLabelText('Largeur de la zone')
    await userEvent.clear(field)
    await userEvent.type(field, '900')
    await userEvent.tab()

    const layer = armed()
    expect(layer?.kind === 'text' && layer.box.width).toBe(900)
  })
})
