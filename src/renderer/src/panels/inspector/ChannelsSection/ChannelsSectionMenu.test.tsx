import { render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import type { EditPixels } from '@/helpers/openAsset'
import { ChannelsSectionMenu } from './ChannelsSectionMenu'
import type { ChannelDerivation } from './derivation'

const READY: ChannelDerivation = { source: 'baseColor', state: 'ready', run: vi.fn() }

const open = (
  derivation: ChannelDerivation | null = READY,
  pixels: EditPixels | null = null,
): void => {
  render(
    <ChannelsSectionMenu
      derivation={derivation}
      pixels={pixels}
      at={{ x: 10, y: 10 }}
      onClose={vi.fn()}
    />,
  )
}

describe('ChannelsSectionMenu', () => {
  it('says what the row does to the channel rather than reading it back', () => {
    open()

    expect(screen.getByRole('menuitem', { name: /Calculer depuis/ })).toHaveAttribute(
      'data-tooltip-content',
      'Calcule ce canal à partir d’un autre plutôt que d’une image importée',
    )
  })

  // The row that refuses is the one most in need of saying what would let it work.
  it('names the channel to fill first when the source is empty', () => {
    open({ ...READY, state: 'missing' })

    const row = screen.getByRole('menuitem', {
      name: 'Calculer depuis Couleur de base — Couleur de base est vide',
    })
    expect(row).toBeDisabled()
  })

  it('leaves the visible label to answer for itself', () => {
    open()

    // An `aria-label` over a visible label replaces it for a screen reader (WCAG 2.5.3).
    for (const row of screen.getAllByRole('menuitem')) {
      expect(row).not.toHaveAttribute('aria-label')
    }
  })

  /**
   * Four of the eight channels compute from nothing — `baseColor` first among them — so a menu
   * that only ever held a derivation did not open at all on the very row a model's colour lands in.
   */
  it('offers to paint a channel that nothing computes', () => {
    const run = vi.fn()
    open(null, { workspace: 'image', run })

    screen.getByRole('menuitem', { name: 'Modifier l’image' }).click()

    expect(run).toHaveBeenCalled()
  })
})
