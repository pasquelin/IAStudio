import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it } from 'vitest'
import { groupLayer, pixelLayer, type Layer } from '@/engines/canvas/canvas-state'
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
})
