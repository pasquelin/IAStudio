import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { FoldRule } from './FoldRule'

const rule = (open: boolean, onToggle = vi.fn()) => {
  render(
    <FoldRule
      open={open}
      onToggle={onToggle}
      moreLabel="Plus"
      fewerLabel="Moins"
      moreHint="Montrer le reste"
      fewerHint="Replier le reste"
    />,
  )
  return onToggle
}

describe('the rule that opens what it separates', () => {
  // The word is the whole affordance: a bare line divides, it does not offer.
  it('says what pressing it will do', () => {
    rule(false)

    expect(screen.getByRole('button', { name: /Plus/ })).toBeVisible()
  })

  it('says the other thing once what it hides is open', () => {
    rule(true)

    expect(screen.getByRole('button', { name: /Moins/ })).toHaveAttribute('aria-expanded', 'true')
  })

  it('hands the press back rather than holding the state', async () => {
    const onToggle = rule(false)

    await userEvent.click(screen.getByRole('button'))

    expect(onToggle).toHaveBeenCalledOnce()
  })
})
