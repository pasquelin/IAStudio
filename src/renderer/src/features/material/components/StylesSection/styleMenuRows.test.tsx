import { render, screen } from '@testing-library/react'
import { useTranslation } from 'react-i18next'
import { describe, expect, it, vi } from 'vitest'
import { NO_BREAK_SPACE } from '@shared/i18n/typography'
import { ContextMenu } from '@/components/ContextMenu'
import { renderMenuRows } from '@/components/menuRows'
import { styleMenuRows } from './styleMenuRows'

/** At the pointer, as the style row raises them. */
const open = (): void => {
  function Menu() {
    const { t } = useTranslation()
    return (
      <ContextMenu at={{ x: 10, y: 10 }} onClose={vi.fn()}>
        {renderMenuRows(styleMenuRows(t, 's1', vi.fn()), vi.fn())}
      </ContextMenu>
    )
  }

  render(<Menu />)
}

describe('what can be done to a saved style', () => {
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

  /** The button that opens them asks the list rather than being told a figure beside it. */
  it('counts its own rows', () => {
    open()

    expect(screen.getAllByRole('menuitem')).toHaveLength(2)
  })

  it('leaves the visible labels to answer for themselves', () => {
    open()

    // An `aria-label` over a visible label replaces it for a screen reader (WCAG 2.5.3).
    for (const row of screen.getAllByRole('menuitem')) {
      expect(row).not.toHaveAttribute('aria-label')
    }
  })
})
