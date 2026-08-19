import { render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { NO_BREAK_SPACE } from '@shared/i18n/typography'
import { StylesSectionMenu } from './StylesSectionMenu'

const open = (): void => {
  render(<StylesSectionMenu id="s1" at={{ x: 10, y: 10 }} onRename={vi.fn()} onClose={vi.fn()} />)
}

describe('StylesSectionMenu', () => {
  it('says what each row does to the style rather than reading it back', () => {
    open()

    expect(screen.getByRole('menuitem', { name: 'Renommer' })).toHaveAttribute(
      'data-tooltip-content',
      'Change le nom du style enregistré, sans toucher à ce qu’il contient',
    )
    expect(screen.getByRole('menuitem', { name: 'Supprimer' })).toHaveAttribute(
      'data-tooltip-content',
      `Retire le style de la liste${NO_BREAK_SPACE}; les documents qui s’en servaient gardent leur réglage`,
    )
  })

  it('leaves the visible labels to answer for themselves', () => {
    open()

    // An `aria-label` over a visible label replaces it for a screen reader (WCAG 2.5.3).
    for (const row of screen.getAllByRole('menuitem')) {
      expect(row).not.toHaveAttribute('aria-label')
    }
  })
})
