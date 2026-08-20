import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { DEFAULT_CANVAS, textLayer, type TextLayer } from '@/engines/canvas/canvasState'
import { installCanvas } from '@/stores/canvas-fixtures'
import { canvasOf, useCanvases } from '@/stores/canvases'
import { ImageDocumentText } from './ImageDocumentText'

const DOCUMENT = 'doc-1'
const VIEW = { x: 40, y: 20, scale: 2 }

const caption = (over: Partial<TextLayer> = {}): TextLayer => ({
  ...textLayer('t', 'Bonjour', { x: 10, y: 30 }),
  ...over,
})

const stack = () => canvasOf(useCanvases.getState(), DOCUMENT)

function show(layer = caption(), onDone = vi.fn()): { onDone: ReturnType<typeof vi.fn> } {
  installCanvas(DOCUMENT, { ...DEFAULT_CANVAS, layers: [layer], activeLayerId: layer.id })
  render(
    <ImageDocumentText
      documentId={DOCUMENT}
      layer={layer}
      viewport={VIEW}
      inset={20}
      label="Saisie du texte"
      onDone={onDone}
    />,
  )
  return { onDone }
}

const field = (): HTMLTextAreaElement => screen.getByLabelText('Saisie du texte')

describe('ImageDocumentText', () => {
  beforeEach(() => {
    installCanvas(DOCUMENT)
  })

  it('writes what is typed into the layer itself, not into a copy', async () => {
    show()

    await userEvent.type(field(), '!')

    const written = stack().layers[0]
    expect(written?.kind === 'text' && written.text).toBe('Bonjour!')
  })

  /**
   * The field lies exactly over the box the words will occupy: the layer's own origin through
   * the viewport, the rulers' inset after it, and everything scaled by the zoom.
   */
  it('lies over the box the caption occupies, at the zoom it is read at', () => {
    show(caption({ box: { width: 100, height: 50 } }))

    expect(field().style.left).toBe('80px')
    expect(field().style.top).toBe('100px')
    expect(field().style.width).toBe('200px')
    expect(field().style.fontSize).toBe('96px')
  })

  // A caption has lines: Enter makes one, and only Escape ends the session.
  it('ends the session on Escape and never on Enter', async () => {
    const { onDone } = show()

    await userEvent.type(field(), '{Enter}')
    expect(onDone).not.toHaveBeenCalled()

    await userEvent.type(field(), '{Escape}')
    expect(onDone).toHaveBeenCalled()
  })
})
