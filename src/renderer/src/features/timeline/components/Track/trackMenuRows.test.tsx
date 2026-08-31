import { render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { useTranslation } from 'react-i18next'
import { ContextMenu } from '@/components/ContextMenu'
import { renderMenuRows } from '@/components/menuRows'
import { trackMenuRows } from './trackMenuRows'

/** At the pointer, as the header column raises them. */
const open = (canRise = true, canFall = true): void => {
  function Menu() {
    const { t } = useTranslation()
    const rows = trackMenuRows(t, { documentId: 'seq-1', trackId: 't1', canRise, canFall })
    return (
      <ContextMenu at={{ x: 10, y: 10 }} onClose={vi.fn()}>
        {renderMenuRows(rows, vi.fn())}
      </ContextMenu>
    )
  }

  render(<Menu />)
}

describe('what can be done to a track', () => {
  it('says what each row does to the track rather than reading it back', () => {
    open()

    const said = (name: string): string | null =>
      screen.getByRole('menuitem', { name }).getAttribute('data-tooltip-content')

    expect(said('Monter la piste')).toBe('Échange cette piste avec celle du dessus')
    expect(said('Descendre la piste')).toBe('Échange cette piste avec celle du dessous')
    expect(said('Supprimer la piste')).toBe('Retire la piste et tous les clips qu’elle porte')
  })

  it('keeps its sentence on a row it disables', () => {
    open(false, false)

    // A greyed row is the one most in need of saying what it would have done.
    const first = screen.getByRole('menuitem', { name: 'Monter la piste' })
    expect(first).toBeDisabled()
    expect(first).toHaveAttribute('data-tooltip-content')
  })

  it('leaves the visible labels to answer for themselves', () => {
    open()

    // An `aria-label` over a visible label replaces it for a screen reader (WCAG 2.5.3).
    for (const row of screen.getAllByRole('menuitem')) {
      expect(row).not.toHaveAttribute('aria-label')
    }
  })
})
