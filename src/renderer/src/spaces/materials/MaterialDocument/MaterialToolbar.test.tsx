import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { setChannel } from '@/engines/material/commands'
import { installTexture } from '@/stores/material-fixtures'
import { materialOf, useMaterials } from '@/stores/materials'
import { inspectedChannel, useMaterialViews } from '@/stores/materialViews'
import { MaterialToolbar } from './MaterialToolbar'

const DOCUMENT = 'tex-bar'

const onFrame = vi.fn()

const fill = (channel: 'baseColor' | 'roughness'): void => {
  useMaterials
    .getState()
    .runCommand(
      DOCUMENT,
      setChannel(channel, { assetId: `${channel}-1`, origin: 'imported', width: 8, height: 8 }),
    )
}

const preview = () => materialOf(useMaterials.getState(), DOCUMENT).preview
const inspected = () => inspectedChannel(useMaterialViews.getState(), DOCUMENT)

const show = () => render(<MaterialToolbar documentId={DOCUMENT} onFrame={onFrame} />)

beforeEach(() => {
  installTexture(DOCUMENT)
  useMaterialViews.setState({ inspected: {} })
  onFrame.mockClear()
})

/**
 * The bar writes through the same door the inspector does, `setPreview`, so what these cases
 * check is the wiring: which value each button moves, and that none of them writes into the
 * material — a preview that reached `material.tiling` would send a texture out into a scene
 * repeated four times over.
 */
describe('the texture bar', () => {
  it('steps to the next support when its button is clicked', async () => {
    show()

    await userEvent.click(screen.getByRole('button', { name: 'Sphère' }))

    expect(preview().shape).toBe('box')
  })

  it('picks a support outright from its flyout', async () => {
    show()

    await userEvent.hover(screen.getByRole('button', { name: 'Sphère' }))
    await userEvent.click(await screen.findByRole('menuitemradio', { name: 'Plan' }))

    expect(preview().shape).toBe('plane')
  })

  it('turns the repeat preview up without touching what the material repeats', async () => {
    show()

    await userEvent.click(screen.getByRole('button', { name: '1×' }))

    expect(preview().tilingPreview).toBe(2)
    expect(materialOf(useMaterials.getState(), DOCUMENT).material.tiling).toEqual({ x: 1, y: 1 })
  })

  it('goes to the filled channel and back to the lit material', async () => {
    fill('baseColor')
    show()

    const button = screen.getByRole('button', { name: 'Matière éclairée' })
    await userEvent.click(button)
    expect(inspected()).toBe('baseColor')

    await userEvent.click(button)
    expect(inspected()).toBeNull()
  })

  it('leaves the material showing when no channel holds a picture', async () => {
    show()

    await userEvent.click(screen.getByRole('button', { name: 'Matière éclairée' }))

    expect(inspected()).toBeNull()
  })

  it('flips each of the three view toggles', async () => {
    show()

    await userEvent.click(screen.getByRole('button', { name: 'Amener les coutures au centre' }))
    await userEvent.click(screen.getByRole('button', { name: 'Rotation automatique' }))
    await userEvent.click(screen.getByRole('button', { name: 'Afficher le fond' }))

    expect(preview().showSeam).toBe(true)
    expect(preview().autoSpin).toBe(true)
    // Shown by default, so one click turns it off — the other two turn on.
    expect(preview().showBackground).toBe(false)
  })

  /** The camera belongs to the engine, which the document holds: the bar only asks. */
  it('asks its host to recentre rather than reaching for a camera', async () => {
    show()

    await userEvent.click(screen.getByRole('button', { name: 'Recentrer' }))

    expect(onFrame).toHaveBeenCalledTimes(1)
  })

  /**
   * Every click of it is one undo entry of its own. Coalescing is per setting id, so stepping the
   * support three times must not collapse into one — three glances back is three ⌘Z.
   */
  it('leaves an undo entry behind, as the inspector does', async () => {
    show()

    await userEvent.click(screen.getByRole('button', { name: 'Sphère' }))
    useMaterials.getState().undo(DOCUMENT)

    expect(preview().shape).toBe('sphere')
  })
})
