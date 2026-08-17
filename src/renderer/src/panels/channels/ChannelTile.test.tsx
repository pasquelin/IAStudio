import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { NO_BREAK_SPACE } from '@shared/i18n/typography'
import { ChannelTile, type ChannelDerivation } from './ChannelTile'

const OPTIONS = [{ id: 'img-1', name: 'Brick' }]

const DERIVATION: ChannelDerivation = { source: 'baseColor', state: 'ready', run: vi.fn() }

async function openMenu(
  options: readonly { id: string; name: string }[] = OPTIONS,
  derivation: ChannelDerivation | null = DERIVATION,
): Promise<void> {
  render(
    <ChannelTile
      channel="normal"
      map={null}
      options={options}
      inspected={false}
      derivation={derivation}
      onPick={vi.fn()}
      onClear={vi.fn()}
      onInspect={vi.fn()}
    />,
  )
  await userEvent.click(screen.getByRole('button', { name: /Ce que contient/ }))
}

describe('ChannelTile', () => {
  it('says what each row does to the channel rather than reading it back', async () => {
    await openMenu()

    expect(screen.getByRole('menuitem', { name: /Calculer depuis/ })).toHaveAttribute(
      'data-tooltip-content',
      'Calcule ce canal à partir d’un autre plutôt que d’une image importée',
    )
    expect(screen.getByRole('menuitemradio', { name: 'Vider ce canal' })).toHaveAttribute(
      'data-tooltip-content',
      `Retire l’image du canal${NO_BREAK_SPACE}; la matière reprend sa valeur par défaut`,
    )
    expect(screen.getByRole('menuitemradio', { name: 'Brick' })).toHaveAttribute(
      'data-tooltip-content',
      'Pose cette image sur le canal',
    )
  })

  // The row that refuses is the one most in need of saying what would let it work.
  it('tells an empty project how to get a picture to put here', async () => {
    await openMenu([], null)

    const row = screen.getByRole('menuitem', { name: 'Aucune image dans ce projet' })
    expect(row).toBeDisabled()
    expect(row).toHaveAttribute(
      'data-tooltip-content',
      'Générez ou importez une image pour pouvoir en poser une ici',
    )
  })

  it('leaves the visible labels to answer for themselves', async () => {
    await openMenu()

    // An `aria-label` over a visible label replaces it for a screen reader (WCAG 2.5.3).
    const rows = [...screen.getAllByRole('menuitem'), ...screen.getAllByRole('menuitemradio')]
    for (const row of rows) {
      expect(row).not.toHaveAttribute('aria-label')
    }
  })
})
