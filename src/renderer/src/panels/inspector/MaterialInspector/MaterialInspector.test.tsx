import { fireEvent, render, screen } from '@testing-library/react'
import { beforeEach, describe, expect, it } from 'vitest'
import { TRANSLATIONS } from '@shared/i18n'
import { installTexture } from '@/stores/material-fixtures'
import { materialHistoryOf, materialOf, useMaterials } from '@/stores/materials'
import { inSection } from '../inspector-fixtures'
import { MaterialInspector } from './MaterialInspector'

const DOCUMENT = 'tex-1'

beforeEach(() => {
  installTexture(DOCUMENT)
})

const material = () => materialOf(useMaterials.getState(), DOCUMENT).material
const preview = () => materialOf(useMaterials.getState(), DOCUMENT).preview
const entries = () => materialHistoryOf(useMaterials.getState(), DOCUMENT).past.length

const show = (): void => {
  render(<MaterialInspector documentId={DOCUMENT} />)
}

describe('MaterialInspector', () => {
  /**
   * The word was decided rather than inherited: the file, three and the 3D face all say roughness.
   * Asserted against the BUNDLE rather than against a string: `queryByLabelText('Brillance')`
   * looked like a guard and could never fail, no bundle holding that word.
   */
  it('says roughness, never glossiness, so one quantity has one name', () => {
    show()

    expect(inSection('Matière').getByLabelText('Rugosité')).toBeInTheDocument()
    expect(JSON.stringify(TRANSLATIONS.fr)).not.toMatch(/brillance/i)
  })

  /** Two remaps under one label is two rows a reader cannot tell apart. */
  it('names each remap after the quantity it remaps', () => {
    show()

    expect(screen.getByText('Plage de rugosité')).toBeInTheDocument()
    expect(screen.getByText('Plage de métal')).toBeInTheDocument()
  })

  it('writes a roughness onto the document', () => {
    show()

    fireEvent.change(inSection('Matière').getByLabelText('Rugosité'), { target: { value: '0.4' } })

    expect(material().roughness).toBe(0.4)
  })

  it('remaps what a roughness map holds, both ends apart', () => {
    show()

    fireEvent.change(screen.getByLabelText('Rugosité de'), { target: { value: '0.3' } })
    fireEvent.change(screen.getByLabelText('Rugosité à'), { target: { value: '0.6' } })

    expect(material().roughnessRange).toEqual({ min: 0.3, max: 0.6 })
  })

  it('remaps metalness on its own range, not on the roughness one', () => {
    show()

    fireEvent.change(screen.getByLabelText('Métal de'), { target: { value: '0.2' } })

    expect(material().metalnessRange).toEqual({ min: 0.2, max: 1 })
    expect(material().roughnessRange).toEqual({ min: 0, max: 1 })
  })

  it('offers the cavity, whose setting had no reader at all before', () => {
    show()

    fireEvent.change(inSection('Matière').getByLabelText('Cavité'), { target: { value: '0.7' } })

    expect(material().edgeIntensity).toBe(0.7)
  })

  it('lets the relief be flipped, for a normal map baked the other way round', () => {
    show()

    fireEvent.click(screen.getByLabelText('Inverser le vert'))

    expect(material().invertNormalGreen).toBe(true)
  })

  it('takes a negative normal scale, which is the other answer to the same problem', () => {
    show()

    fireEvent.change(inSection('Relief').getByLabelText('Normale'), { target: { value: '-1' } })

    expect(material().normalScale).toBe(-1)
  })

  /** Folded on sight: a tiling is set once and then left alone, unlike the finish above it. */
  it('keeps the tiling section folded until it is asked for', () => {
    show()

    expect(screen.queryByLabelText('Rotation')).toBeNull()

    fireEvent.click(screen.getByRole('button', { name: /Répétition/ }))

    expect(screen.getByLabelText('Rotation')).toBeInTheDocument()
  })

  it('applies one repeat to every channel at once, which is what keeps them aligned', () => {
    show()
    fireEvent.click(screen.getByRole('button', { name: /Répétition/ }))

    fireEvent.change(screen.getAllByLabelText('X')[0] ?? document.body, {
      target: { value: '4' },
    })

    expect(material().tiling).toEqual({ x: 4, y: 1 })
  })

  /** Degrees on screen, radians in the file — the trade the sky inspector already makes. */
  it('reads a rotation in degrees and stores it in radians', () => {
    show()
    fireEvent.click(screen.getByRole('button', { name: /Répétition/ }))

    fireEvent.change(screen.getByLabelText('Rotation'), { target: { value: '90' } })

    expect(material().rotation).toBeCloseTo(Math.PI / 2)
  })

  it('does the same for the rotation of the sky', () => {
    show()

    fireEvent.change(screen.getByLabelText('Rotation du ciel'), { target: { value: '180' } })

    expect(preview().envRotation).toBeCloseTo(Math.PI)
  })

  /**
   * These two rows change how the texture is LOOKED at and never reach a scene — a distinction
   * the chips cannot draw, since they sit under the values they seem to multiply.
   */
  it('says that the preview rows change nothing that gets exported', () => {
    show()

    expect(screen.getByRole('combobox', { name: 'Forme' })).toHaveAttribute(
      'data-tooltip-content',
      'Change la forme sur laquelle l’aperçu est plaqué, pas la texture',
    )
  })

  it('chooses the shape the material is judged on', () => {
    show()

    fireEvent.change(screen.getByRole('combobox', { name: 'Forme' }), { target: { value: 'box' } })

    expect(preview().shape).toBe('box')
  })

  it('shows which shape is current, so the row is not five identical words', () => {
    show()

    expect(screen.getByRole('combobox', { name: 'Forme' })).toHaveValue('sphere')
  })

  it('hangs the sky behind the subject, or only lights with it', () => {
    show()

    fireEvent.click(screen.getByLabelText('Afficher le fond'))

    expect(preview().showBackground).toBe(false)
  })

  it('lights the preview with the environment section the 3D space already had', () => {
    show()

    expect(screen.getByText('Environnement')).toBeInTheDocument()
    expect(screen.getByText('Ciel')).toBeInTheDocument()
    // Nothing chosen means the procedural studio, exactly as a scene reads before a sky exists.
    expect(screen.getByText('Studio')).toBeInTheDocument()
  })

  it('collapses a whole drag into one history entry', () => {
    show()
    const slider = inSection('Matière').getByLabelText('Rugosité')

    fireEvent.pointerDown(slider)
    fireEvent.change(slider, { target: { value: '0.4' } })
    fireEvent.change(slider, { target: { value: '0.5' } })
    fireEvent.change(slider, { target: { value: '0.6' } })
    fireEvent.pointerUp(slider)

    expect(material().roughness).toBe(0.6)
    expect(entries()).toBe(1)
  })

  it('keeps two settings in two entries, so one undo does not take both', () => {
    show()

    fireEvent.change(inSection('Matière').getByLabelText('Rugosité'), { target: { value: '0.4' } })
    fireEvent.change(inSection('Matière').getByLabelText('Métal'), { target: { value: '0.9' } })

    expect(entries()).toBe(2)
  })
})
