import { fireEvent, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it } from 'vitest'
import {
  adjustmentLayer,
  DEFAULT_SHAPE_SIDES,
  groupLayer,
  pixelLayer,
  shapeLayer,
  textLayer,
  type Layer,
  type ShapeLayer,
} from '@/engines/canvas/canvasState'
import { addLayer } from '@/engines/canvas/commands'
import { installCanvas } from '@/stores/canvas-fixtures'
import { canvasOf, useCanvases } from '@/stores/canvases'
import { LayerInspector } from './LayerInspector'

const DOCUMENT = 'doc-1'

beforeEach(() => {
  installCanvas(DOCUMENT)
})

const stack = () => canvasOf(useCanvases.getState(), DOCUMENT)
const first = (): Layer | undefined => stack().layers[0]

function show(layer: Layer = pixelLayer('layer-1', 'Background')): void {
  render(<LayerInspector documentId={DOCUMENT} layer={layer} />)
}

describe('LayerInspector', () => {
  it('offers every blend mode the state declares, now that they all blend', async () => {
    show()

    expect(screen.getAllByRole('option')).toHaveLength(16)
  })

  it('writes the chosen blend mode into the layer', async () => {
    show()
    await userEvent.selectOptions(screen.getByLabelText('Fusion'), 'multiply')

    expect(first()?.blend).toBe('multiply')
  })

  // Two sliders that look alike and are not: one fades the layer, the other only its pixels.
  it('keeps fill opacity apart from the layer opacity', async () => {
    show()

    expect(screen.getByLabelText('Opacité')).toBeInTheDocument()
    expect(screen.getByLabelText('Opacité du fond')).toBeInTheDocument()
  })

  it('clips the layer onto the one below it', async () => {
    show()
    await userEvent.click(screen.getByLabelText(/^Écrêté/))

    expect(first()?.clipped).toBe(true)
  })

  it('opens one padlock without touching the other two', async () => {
    show()
    await userEvent.click(screen.getByLabelText('Position'))

    expect(first()?.locked).toEqual({ pixels: false, position: true, alpha: false })
  })

  // Radians are what the engine turns; nobody types in them.
  it('takes the rotation in degrees and stores it in radians', async () => {
    show()
    const field = screen.getByLabelText('Rotation')
    await userEvent.clear(field)
    await userEvent.type(field, '90')
    await userEvent.tab()

    expect(first()?.transform.rotation).toBeCloseTo(Math.PI / 2)
  })

  it('moves the layer without disturbing the rest of its transform', async () => {
    show()
    const field = screen.getByLabelText('X')
    await userEvent.clear(field)
    await userEvent.type(field, '40')
    await userEvent.tab()

    expect(first()?.transform).toMatchObject({ x: 40, scaleX: 1, originX: 0.5 })
  })

  // A group has no pixels of its own, but it does have a place: it carries its children.
  it('counts the children of a group', () => {
    show(groupLayer('g', 'Group', [pixelLayer('a', 'A'), pixelLayer('b', 'B')]))

    expect(screen.getByText('2')).toBeInTheDocument()
  })

  describe('an adjustment layer', () => {
    const graded = () => adjustmentLayer('grade', 'Exposure', 'exposure')

    it('shows the one dial it exposes', () => {
      show(graded())

      expect(screen.getByLabelText('Exposition')).toBeInTheDocument()
    })

    it('writes the dial into the layer without disturbing the others', () => {
      const layer = graded()
      useCanvases.getState().runCommand(DOCUMENT, addLayer(layer))
      render(<LayerInspector documentId={DOCUMENT} layer={layer} />)

      fireEvent.change(screen.getByLabelText('Exposition'), { target: { value: '1.5' } })

      const written = stack().layers.at(-1)
      expect(written?.kind === 'adjustment' && written.values).toMatchObject({
        exposure: 1.5,
        contrast: 1,
        saturation: 1,
      })
    })

    // A pixel layer has no dial to show: the section belongs to the kind that carries one.
    it('shows no dial on a layer that has none', () => {
      show()

      expect(screen.queryByLabelText('Exposition')).not.toBeInTheDocument()
    })
  })

  /** A shape kept as geometry is a shape whose paint is still editable — the whole point of it. */
  describe('a shape', () => {
    const drawn = (over: Partial<ShapeLayer> = {}): ShapeLayer => ({
      ...shapeLayer(
        's',
        'Rectangle',
        { x: 4, y: 4 },
        {
          shape: 'rectangle',
          from: { x: 0, y: 0 },
          to: { x: 20, y: 10 },
          sides: DEFAULT_SHAPE_SIDES,
          fill: 0x000000,
          stroke: null,
        },
      ),
      ...over,
    })

    const showing = (layer: ShapeLayer): void => {
      useCanvases.getState().runCommand(DOCUMENT, addLayer(layer))
      render(<LayerInspector documentId={DOCUMENT} layer={layer} />)
    }

    it('recolours a shape drawn long ago', () => {
      showing(drawn())

      fireEvent.change(screen.getByLabelText('Couleur de remplissage'), {
        target: { value: '#ff0000' },
      })

      const written = stack().layers.at(-1)
      expect(written?.kind === 'shape' && written.fill).toBe(0xff0000)
    })

    it('empties the inside, which is what an outlined rectangle is', async () => {
      showing(drawn())

      await userEvent.click(screen.getByLabelText('Remplir'))

      const written = stack().layers.at(-1)
      expect(written?.kind === 'shape' && written.fill).toBeNull()
    })

    it('gives a stroke a width once there is one to widen', async () => {
      showing(drawn({ stroke: { color: 0x000000, width: 2 } }))

      fireEvent.change(screen.getByLabelText('Épaisseur'), { target: { value: '8' } })

      const written = stack().layers.at(-1)
      expect(written?.kind === 'shape' && written.stroke?.width).toBe(8)
    })

    // A rectangle has no point count, and a field that means nothing is a field that misleads.
    it('counts points on a shape drawn from a centre', () => {
      showing(drawn({ shape: 'star' }))

      expect(screen.getByLabelText('Points')).toBeInTheDocument()
    })

    it('counts none on one drawn corner to corner', () => {
      showing(drawn())

      expect(screen.queryByLabelText('Points')).not.toBeInTheDocument()
    })
  })

  describe('a caption', () => {
    const words = () => textLayer('t', 'Hello', { x: 0, y: 0 })

    it('edits the words in place', () => {
      const layer = words()
      useCanvases.getState().runCommand(DOCUMENT, addLayer(layer))
      render(<LayerInspector documentId={DOCUMENT} layer={layer} />)

      fireEvent.change(screen.getByLabelText('Mots'), { target: { value: 'Bonjour' } })

      const written = stack().layers.at(-1)
      expect(written?.kind === 'text' && written.text).toBe('Bonjour')
    })

    it('sets the size in points', () => {
      const layer = words()
      useCanvases.getState().runCommand(DOCUMENT, addLayer(layer))
      render(<LayerInspector documentId={DOCUMENT} layer={layer} />)

      fireEvent.change(screen.getByLabelText('Corps'), { target: { value: '72' } })

      const written = stack().layers.at(-1)
      expect(written?.kind === 'text' && written.size).toBe(72)
    })

    // Words belong to the kind that has them; a pixel layer must not grow a text field.
    it('offers no words on a layer that has none', () => {
      show()

      expect(screen.queryByLabelText('Mots')).not.toBeInTheDocument()
    })
  })
})
